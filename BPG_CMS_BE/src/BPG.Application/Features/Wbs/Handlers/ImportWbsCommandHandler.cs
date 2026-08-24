using BPG.Application.DTOs.Wbs;
using BPG.Application.Features.Wbs.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using ClosedXML.Excel;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IServices;

namespace BPG.Application.Features.Wbs.Handlers;

public class ImportWbsCommandHandler : IRequestHandler<ImportWbsCommand, ImportWbsResultDto>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUserService;

    public ImportWbsCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
    {
        _uow = uow;
        _currentUserService = currentUserService;
    }

    public async Task<ImportWbsResultDto> Handle(ImportWbsCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException("Project", request.ProjectId);

        if (project.Status != ProjectStatus.Draft && project.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Chỉ được phép import WBS khi dự án ở trạng thái Nháp hoặc Đang hoạt động.");

        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
        {
            throw new ForbiddenException("Chỉ Quản lý kỹ thuật (TPKT) mới được phép import WBS.");
        }

        var projectMembers = await _uow.Repository<ProjectMember>().Query()
            .Include(pm => pm.User)
            .Where(pm => pm.ProjectId == request.ProjectId)
            .ToListAsync(cancellationToken);
        
        var usersByEmail = projectMembers
            .Where(pm => pm.User != null && !string.IsNullOrWhiteSpace(pm.User.Email))
            .GroupBy(pm => pm.User.Email.ToLower().Trim())
            .ToDictionary(g => g.Key, g => g.First().UserId);

        var result = new ImportWbsResultDto();
        var phasesToCreate = new List<Phase>();
        
        using var stream = new MemoryStream();
        await request.File.CopyToAsync(stream, cancellationToken);
        stream.Position = 0;

        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.FirstOrDefault() ?? throw new InvalidOperationException("File Excel không có worksheet nào.");

        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;

        int phaseOrder = await _uow.Repository<Phase>().Query()
            .Where(p => p.ProjectId == request.ProjectId)
            .Select(p => (int?)p.OrderIndex).MaxAsync(cancellationToken) ?? 0;

        var phasesByCode = new Dictionary<string, Phase>();
        var tasksByCode = new Dictionary<string, ProjectTask>();
        // Lưu tạm danh sách predecessorsRaw của mỗi task để resolve sau
        var taskPredecessorsRawMap = new Dictionary<ProjectTask, string>();

        for (int row = 2; row <= lastRow; row++)
        {
            var wbsCode = worksheet.Cell(row, 1).GetString().Trim();
            var name = worksheet.Cell(row, 2).GetString().Trim();
            var desc = worksheet.Cell(row, 3).GetString().Trim();
            var startDateRaw = worksheet.Cell(row, 4).Value;
            var endDateRaw = worksheet.Cell(row, 5).Value;
            var priorityName = worksheet.Cell(row, 6).GetString().Trim();
            var outsourcedRaw = worksheet.Cell(row, 7).GetString().Trim().ToLower();
            var outsourcedTeamName = worksheet.Cell(row, 8).GetString().Trim();
            var outsourcedTeamContact = worksheet.Cell(row, 9).GetString().Trim();
            var assigneesRaw = worksheet.Cell(row, 10).GetString().Trim();
            var predecessorsRaw = worksheet.Cell(row, 11).GetString().Trim();

            if (string.IsNullOrWhiteSpace(wbsCode) && string.IsNullOrWhiteSpace(name)) continue;

            if (string.IsNullOrWhiteSpace(name))
            {
                result.Errors.Add($"Dòng {row}: Tên không được để trống.");
                continue;
            }
            if (string.IsNullOrWhiteSpace(wbsCode))
            {
                result.Errors.Add($"Dòng {row}: Chỉ mục không được để trống.");
                continue;
            }

            DateOnly? startDate = ParseDate(startDateRaw);
            DateOnly? endDate = ParseDate(endDateRaw);

            if (startDate == null || endDate == null)
            {
                result.Errors.Add($"Dòng {row}: Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.");
                continue;
            }
            if (startDate > endDate)
            {
                result.Errors.Add($"Dòng {row}: Ngày bắt đầu không được lớn hơn ngày kết thúc.");
                continue;
            }

            int dotsCount = wbsCode.Count(c => c == '.');
            bool isOutsourced = outsourcedRaw == "x";

            if (dotsCount == 0) // Giai đoạn
            {
                if (startDate < project.PlannedStart || endDate > project.PlannedEnd)
                {
                    result.Errors.Add($"Dòng {row}: Thời gian giai đoạn phải nằm trong thời gian dự án ({project.PlannedStart:dd/MM/yyyy} - {project.PlannedEnd:dd/MM/yyyy}).");
                    continue;
                }

                phaseOrder++;
                var phase = new Phase
                {
                    ProjectId = project.ProjectId,
                    Name = name,
                    Description = string.IsNullOrWhiteSpace(desc) ? null : desc,
                    OrderIndex = phaseOrder,
                    StartDate = startDate,
                    EndDate = endDate,
                    Status = PhaseStatus.Draft,
                    Tasks = new List<ProjectTask>()
                };
                phasesToCreate.Add(phase);
                phasesByCode[wbsCode] = phase;
            }
            else if (dotsCount == 1 || dotsCount == 2) // Công việc & Công việc con
            {
                var parentCode = wbsCode.Substring(0, wbsCode.LastIndexOf('.'));
                
                Phase? parentPhase = null;
                ProjectTask? parentTask = null;
                
                if (dotsCount == 1)
                {
                    if (!phasesByCode.TryGetValue(parentCode, out parentPhase))
                    {
                        result.Errors.Add($"Dòng {row}: Không tìm thấy Giai đoạn cha (chỉ mục {parentCode}) cho Công việc {wbsCode}.");
                        continue;
                    }
                    if (startDate < parentPhase.StartDate || endDate > parentPhase.EndDate)
                    {
                        result.Errors.Add($"Dòng {row}: Thời gian công việc phải nằm trong giai đoạn cha ({parentPhase.StartDate:dd/MM/yyyy} - {parentPhase.EndDate:dd/MM/yyyy}).");
                        continue;
                    }
                }
                else
                {
                    if (!tasksByCode.TryGetValue(parentCode, out parentTask))
                    {
                        result.Errors.Add($"Dòng {row}: Không tìm thấy Công việc cha (chỉ mục {parentCode}) cho Công việc con {wbsCode}.");
                        continue;
                    }
                    if (startDate < parentTask.StartDate || endDate > parentTask.EndDate)
                    {
                        result.Errors.Add($"Dòng {row}: Thời gian công việc con phải nằm trong công việc cha ({parentTask.StartDate:dd/MM/yyyy} - {parentTask.EndDate:dd/MM/yyyy}).");
                        continue;
                    }
                }

                decimal? weight = null;
                if (!string.IsNullOrWhiteSpace(priorityName))
                {
                    if (decimal.TryParse(priorityName, out var parsedWeight))
                    {
                        weight = parsedWeight;
                    }
                    else
                    {
                        var p = priorityName.ToLower();
                        if (p.Contains("bình thường") || p.StartsWith("1")) weight = 1;
                        else if (p.Contains("rất quan trọng") || p.Contains("đặc biệt") || p.StartsWith("4")) weight = 4;
                        else if (p.Contains("quan trọng") || p.StartsWith("3")) weight = 3;
                        else if (p.Contains("cao") || p.StartsWith("2")) weight = 2;
                    }
                }

                var task = new ProjectTask
                {
                    Phase = dotsCount == 1 ? parentPhase! : parentTask!.Phase,
                    Name = name,
                    Description = string.IsNullOrWhiteSpace(desc) ? null : desc,
                    OrderIndex = dotsCount == 1 ? parentPhase!.Tasks.Count + 1 : parentTask!.SubTasks.Count + 1,
                    StartDate = startDate.Value,
                    EndDate = endDate.Value,
                    Status = BPG.Domain.Constants.TaskStatus.New,
                    ProgressPercent = 0,
                    Weight = weight,
                    IsOutsourced = isOutsourced,
                    OutsourcedTeamName = isOutsourced && !string.IsNullOrWhiteSpace(outsourcedTeamName) ? outsourcedTeamName : null,
                    OutsourcedTeamContact = isOutsourced && !string.IsNullOrWhiteSpace(outsourcedTeamContact) ? outsourcedTeamContact : null,
                    SubTasks = new List<ProjectTask>(),
                    Assignees = new List<TaskAssignee>(),
                    Dependencies = new List<TaskDependency>()
                };

                // Add assignees
                if (!string.IsNullOrWhiteSpace(assigneesRaw))
                {
                    var emails = assigneesRaw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                                             .Select(e => e.Trim().ToLower())
                                             .Distinct();
                    
                    foreach (var email in emails)
                    {
                        if (usersByEmail.TryGetValue(email, out var userId))
                        {
                            task.Assignees.Add(new TaskAssignee { UserId = userId, AssignedAt = DateTime.UtcNow });
                        }
                        else
                        {
                            result.Errors.Add($"Dòng {row}: Không tìm thấy nhân viên với email '{email}' trong dự án này.");
                        }
                    }
                }

                if (!string.IsNullOrWhiteSpace(predecessorsRaw))
                {
                    taskPredecessorsRawMap[task] = predecessorsRaw;
                }

                if (dotsCount == 1)
                {
                    parentPhase!.Tasks.Add(task);
                }
                else
                {
                    parentTask!.SubTasks.Add(task);
                }
                
                tasksByCode[wbsCode] = task;
            }
            else
            {
                result.Errors.Add($"Dòng {row}: Hệ thống BPG CMS chỉ hỗ trợ tối đa 3 cấp WBS (Giai đoạn -> Công việc -> Công việc con). Chỉ mục '{wbsCode}' không hợp lệ.");
            }
        }

        // Process dependencies
        foreach (var (task, predsRaw) in taskPredecessorsRawMap)
        {
            var preds = predsRaw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                                .Select(p => p.Trim())
                                .Distinct();
            foreach (var predCode in preds)
            {
                if (tasksByCode.TryGetValue(predCode, out var predTask))
                {
                    // Tránh dependency vòng tròn đơn giản
                    if (predTask != task)
                    {
                        task.Dependencies.Add(new TaskDependency { Predecessor = predTask });
                    }
                }
                else
                {
                    result.Errors.Add($"Công việc '{task.Name}': Không tìm thấy công việc cần hoàn trước có chỉ mục '{predCode}'.");
                }
            }
        }

        if (result.Errors.Any())
        {
            result.PhaseCount = 0;
            result.TaskCount = 0;
            result.SkippedCount = lastRow - 1; 
            return result;
        }

        if (phasesToCreate.Any())
        {
            await _uow.Repository<Phase>().AddRangeAsync(phasesToCreate, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);
            
            result.PhaseCount = phasesToCreate.Count;
            result.TaskCount = phasesToCreate.Sum(p => p.Tasks.Count + p.Tasks.Sum(t => t.SubTasks.Count));
        }

        result.SkippedCount = lastRow - 1 - result.PhaseCount - result.TaskCount - result.Errors.Count;

        return result;
    }

    private static DateOnly? ParseDate(XLCellValue cellValue)
    {
        if (cellValue.IsDateTime) return DateOnly.FromDateTime(cellValue.GetDateTime());
        
        if (cellValue.IsText)
        {
            var text = cellValue.GetText().Trim();
            if (DateTime.TryParseExact(text, new[] { "dd/MM/yyyy", "d/M/yyyy" }, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dtExact))
            {
                return DateOnly.FromDateTime(dtExact);
            }
            if (DateTime.TryParse(text, out var dt))
            {
                return DateOnly.FromDateTime(dt);
            }
        }
        
        if (cellValue.IsNumber)
        {
            try {
                return DateOnly.FromDateTime(DateTime.FromOADate(cellValue.GetNumber()));
            } catch { }
        }

        return null;
    }
}
