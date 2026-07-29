using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Phases.Commands.CreatePhase;

public record CreatePhaseCommand(
    long ProjectId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly? StartDate,
    DateOnly? EndDate
) : IRequest<ApiResponse<long>>
{
}

public class CreatePhaseCommandValidator : AbstractValidator<CreatePhaseCommand>
{
    public CreatePhaseCommandValidator()
    {
        RuleFor(x => x.ProjectId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OrderIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EndDate.HasValue)
            .WithMessage("NgÃ y káº¿t thÃºc khÃ´ng Ä‘Æ°á»£c nhá» hÆ¡n ngÃ y báº¯t Ä‘áº§u.");
    }
}

public class CreatePhaseCommandHandler : IRequestHandler<CreatePhaseCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreatePhaseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<long>> Handle(CreatePhaseCommand request, CancellationToken ct)
    {
        var project = await _unitOfWork.Repository<Project>()
            .Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, ct);

        if (project == null)
            throw new NotFoundException("Project", request.ProjectId);

        if (request.StartDate.HasValue && request.StartDate.Value < project.PlannedStart)
        {
            throw new BusinessException("ERR_PHASE_DATE_INVALID", $"NgÃ y báº¯t Ä‘áº§u cá»§a giai Ä‘oáº¡n ({request.StartDate.Value:dd/MM/yyyy}) khÃ´ng Ä‘Æ°á»£c trÆ°á»›c ngÃ y báº¯t Ä‘áº§u cá»§a dá»± Ã¡n ({project.PlannedStart:dd/MM/yyyy}).");
        }
        
        if (request.EndDate.HasValue && request.EndDate.Value > project.PlannedEnd)
        {
            throw new BusinessException("ERR_PHASE_DATE_INVALID", $"NgÃ y káº¿t thÃºc cá»§a giai Ä‘oáº¡n ({request.EndDate.Value:dd/MM/yyyy}) khÃ´ng Ä‘Æ°á»£c sau ngÃ y káº¿t thÃºc cá»§a dá»± Ã¡n ({project.PlannedEnd:dd/MM/yyyy}).");
        }

        var phase = new Phase
        {
            ProjectId = request.ProjectId,
            Name = request.Name,
            Description = request.Description,
            OrderIndex = request.OrderIndex,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = BPG.Domain.Constants.PhaseStatus.Draft
        };

        await _unitOfWork.Repository<Phase>().AddAsync(phase);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse<long>.SuccessResult(phase.PhaseId, "Táº¡o phase thÃ nh cÃ´ng.");
    }
}

