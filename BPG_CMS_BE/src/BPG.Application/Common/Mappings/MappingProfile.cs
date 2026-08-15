using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Domain.Entities;
using BPG.Application.DTOs.PhaseAcceptances;
using BPG.Application.DTOs.MaterialCategories;
using BPG.Application.DTOs.MaterialCatalogs;
using System.Linq;

namespace BPG.Application.Common.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // Mapping từ User entity sang UserDto
            CreateMap<User, UserDto>()
                .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.UserId.ToString()))
                .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.FullName))
                .ForMember(dest => dest.Email, opt => opt.MapFrom(src => src.Email))
                .ForMember(dest => dest.Role, opt => opt.MapFrom(src =>
                    src.UserRoles != null && src.UserRoles.Any() && src.UserRoles.FirstOrDefault()!.Role != null
                        ? src.UserRoles.FirstOrDefault()!.Role!.RoleName.ToLower()
                        : string.Empty))
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => UserDto.GetStatus(src)));

            // Mapping từ User entity sang LoginResponse
            CreateMap<User, BPG.Application.DTOs.Auth.LoginResponse>()
                .ForMember(dest => dest.UserId, opt => opt.MapFrom(src => src.UserId))
                .ForMember(dest => dest.FullName, opt => opt.MapFrom(src => src.FullName))
                .ForMember(dest => dest.Email, opt => opt.MapFrom(src => src.Email))
                .ForMember(dest => dest.Role, opt => opt.MapFrom(src => 
                    src.UserRoles != null && src.UserRoles.Any() && src.UserRoles.FirstOrDefault()!.Role != null
                        ? src.UserRoles.FirstOrDefault()!.Role!.RoleName 
                        : string.Empty))
                .ForMember(dest => dest.AccessToken, opt => opt.Ignore()); // AccessToken sẽ được gán thủ công bằng token generator sau

            // Mapping từ SendNotificationCommand sang Notification entity
            CreateMap<BPG.Application.Features.Notifications.Commands.SendNotificationCommand, Notification>()
                .ForMember(dest => dest.NotificationId, opt => opt.Ignore())
                .ForMember(dest => dest.IsRead, opt => opt.MapFrom(src => false))
                .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
                .ForMember(dest => dest.ReadAt, opt => opt.Ignore())
                .ForMember(dest => dest.User, opt => opt.Ignore());

            // Mapping từ Notification entity sang NotificationDto
            CreateMap<Notification, BPG.Application.DTOs.Notifications.NotificationDto>();

            // Phase Acceptance
            CreateMap<PhaseAcceptance, PhaseAcceptanceDto>()
                .ForMember(dest => dest.ProjectId, opt => opt.MapFrom(src => src.Phase != null ? src.Phase.ProjectId : 0))
                .ForMember(dest => dest.PhaseName, opt => opt.MapFrom(src => src.Phase != null ? src.Phase.Name : string.Empty))
                .ForMember(dest => dest.ProjectName, opt => opt.MapFrom(src => src.Phase != null && src.Phase.Project != null ? src.Phase.Project.Name : string.Empty))
                .ForMember(dest => dest.AcceptedByName, opt => opt.MapFrom(src => src.Acceptor != null ? src.Acceptor.FullName : string.Empty))
                .ForMember(dest => dest.CancelledByName, opt => opt.Ignore());

            // Mapping cho Daily Log và Comments
            CreateMap<Comment, BPG.Application.DTOs.DailyLogs.CommentDto>()
                .ForMember(dest => dest.AuthorName, opt => opt.MapFrom(src => src.Author != null ? src.Author.FullName : string.Empty))
                .ForMember(dest => dest.AvatarUrl, opt => opt.MapFrom(src => src.Author != null ? src.Author.AvatarUrl : null))
                .ForMember(dest => dest.AuthorRole, opt => opt.MapFrom(src =>
                    src.Author != null && src.Author.UserRoles != null && src.Author.UserRoles.Any() && src.Author.UserRoles.FirstOrDefault()!.Role != null
                        ? src.Author.UserRoles.FirstOrDefault()!.Role!.RoleName
                        : string.Empty));

            CreateMap<DailyLog, BPG.Application.DTOs.DailyLogs.DailyLogDto>()
                .ForMember(dest => dest.TaskName, opt => opt.MapFrom(src => src.Task != null ? src.Task.Name : string.Empty))
                .ForMember(dest => dest.CreatorName, opt => opt.MapFrom(src => src.Creator != null ? src.Creator.FullName : string.Empty))
                .ForMember(dest => dest.Images, opt => opt.Ignore())
                .ForMember(dest => dest.Comments, opt => opt.MapFrom(src => src.Comments));

            // Mapping cho WBS Tasks
            CreateMap<BPG.Application.Features.Tasks.Commands.CreateTaskCommand, ProjectTask>()
                .ForMember(dest => dest.Assignees, opt => opt.Ignore());

            CreateMap<BPG.Application.Features.Tasks.Commands.UpdateTaskCommand, ProjectTask>();

            CreateMap<Phase, Phase>()
                .ForMember(dest => dest.PhaseId, opt => opt.Ignore())
                .ForMember(dest => dest.OrderIndex, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedBy, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedBy, opt => opt.Ignore())
                .ForMember(dest => dest.IsDeleted, opt => opt.Ignore())
                .ForMember(dest => dest.Project, opt => opt.Ignore())
                .ForMember(dest => dest.Tasks, opt => opt.Ignore())
                .ForMember(dest => dest.Acceptances, opt => opt.Ignore())
                .ForMember(dest => dest.BOQItems, opt => opt.Ignore())
                .ForMember(dest => dest.MaterialRequests, opt => opt.Ignore());

            CreateMap<ProjectTask, ProjectTask>()
                .ForMember(dest => dest.TaskId, opt => opt.Ignore())
                .ForMember(dest => dest.PhaseId, opt => opt.Ignore())
                .ForMember(dest => dest.ParentTaskId, opt => opt.Ignore())
                .ForMember(dest => dest.IncidentId, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.ProgressPercent, opt => opt.Ignore())
                .ForMember(dest => dest.ObsoleteReason, opt => opt.Ignore())
                .ForMember(dest => dest.IsLocked, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedBy, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedBy, opt => opt.Ignore())
                .ForMember(dest => dest.IsDeleted, opt => opt.Ignore())
                .ForMember(dest => dest.Phase, opt => opt.Ignore())
                .ForMember(dest => dest.ParentTask, opt => opt.Ignore())
                .ForMember(dest => dest.LinkedIncident, opt => opt.Ignore())
                .ForMember(dest => dest.SubTasks, opt => opt.Ignore())
                .ForMember(dest => dest.Assignees, opt => opt.Ignore())
                .ForMember(dest => dest.DailyLogs, opt => opt.Ignore())
                .ForMember(dest => dest.ProgressLogs, opt => opt.Ignore())
                .ForMember(dest => dest.Dependencies, opt => opt.Ignore())
                .ForMember(dest => dest.Dependents, opt => opt.Ignore());

            // Mapping cho Supplier
            CreateMap<Supplier, BPG.Application.DTOs.Suppliers.SupplierDto>().ReverseMap();
            // Mapping cho MaterialCategory
            CreateMap<MaterialCategory, MaterialCategoryDto>().ReverseMap();

            // Mapping cho MaterialCatalog
            CreateMap<MaterialCatalog, MaterialCatalogDto>()
                .ForMember(dest => dest.CategoryName, opt => opt.MapFrom(src => src.Category != null ? src.Category.CategoryName : string.Empty))
                .ForMember(dest => dest.BaseUnitName, opt => opt.MapFrom(src => src.BaseUnit != null ? src.BaseUnit.UnitName : string.Empty));

            // Mapping cho Projects
            CreateMap<Project, BPG.Application.Features.Projects.DTOs.ProjectDto>()
                .ForMember(dest => dest.DrawingUrl, opt => opt.MapFrom(src => string.Empty))
                .ForMember(dest => dest.Progress, opt => opt.MapFrom(src => 0));

            CreateMap<Project, BPG.Application.Features.Projects.DTOs.ProjectDetailDto>()
                .ForMember(dest => dest.DrawingUrl, opt => opt.MapFrom(src => string.Empty))
                .ForMember(dest => dest.Progress, opt => opt.MapFrom(src => 0))
                .ForMember(dest => dest.Members, opt => opt.MapFrom(src => src.Members));

            CreateMap<ProjectMember, BPG.Application.Features.Projects.DTOs.ProjectMemberDto>()
                .ForMember(dest => dest.FullName, opt => opt.MapFrom(src => src.User != null ? src.User.FullName : string.Empty))
                .ForMember(dest => dest.Email, opt => opt.MapFrom(src => src.User != null ? src.User.Email : string.Empty))
                .ForMember(dest => dest.PhoneNumber, opt => opt.MapFrom(src => src.User != null ? src.User.PhoneNumber : string.Empty))
                .ForMember(dest => dest.Role, opt => opt.MapFrom(src => 
                    src.User != null && src.User.UserRoles != null && src.User.UserRoles.Any() && src.User.UserRoles.FirstOrDefault()!.Role != null
                        ? src.User.UserRoles.FirstOrDefault()!.Role!.RoleName 
                        : string.Empty));

            CreateMap<Attachment, BPG.Application.Features.Projects.DTOs.AttachmentDto>();

            // Inventory Adjustment Mappings
            CreateMap<Domain.Entities.InventoryAdjustment, BPG.Application.DTOs.Inventory.InventoryAdjustmentDto>()
                .ForMember(dest => dest.ProjectName, opt => opt.MapFrom(src => src.Project != null ? src.Project.Name : string.Empty))
                .ForMember(dest => dest.PhaseName, opt => opt.MapFrom(src => src.Phase != null ? src.Phase.Name : string.Empty))
                .ForMember(dest => dest.CreatorName, opt => opt.Ignore()) // Would need User info, or use audit
                .ForMember(dest => dest.ApproverName, opt => opt.MapFrom(src => src.Approver != null ? src.Approver.FullName : string.Empty))
                .ForMember(dest => dest.Items, opt => opt.MapFrom(src => src.Items));

            CreateMap<Domain.Entities.AdjustmentItem, BPG.Application.DTOs.Inventory.AdjustmentItemDto>()
                .ForMember(dest => dest.MaterialCode, opt => opt.MapFrom(src => src.Material != null ? src.Material.Code : string.Empty))
                .ForMember(dest => dest.MaterialName, opt => opt.MapFrom(src => src.Material != null ? src.Material.Name : string.Empty))
                .ForMember(dest => dest.Specification, opt => opt.MapFrom(src => src.Material != null ? src.Material.Specification : string.Empty))
                .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit != null ? src.Unit.UnitName : string.Empty));

            // Incident Mappings
            CreateMap<Incident, BPG.Application.DTOs.Incidents.IncidentDto>()
                .ForMember(dest => dest.ReporterName, opt => opt.MapFrom(src => src.Reporter != null ? src.Reporter.FullName : string.Empty))
                .ForMember(dest => dest.ReviewerName, opt => opt.MapFrom(src => src.Reviewer != null ? src.Reviewer.FullName : string.Empty))
                .ForMember(dest => dest.ProjectName, opt => opt.MapFrom(src => src.Project != null ? src.Project.Name : string.Empty))
                .ForMember(dest => dest.TaskName, opt => opt.MapFrom(src => src.Task != null ? src.Task.Name : string.Empty))
                .ForMember(dest => dest.PhaseName, opt => opt.MapFrom(src => src.Phase != null ? src.Phase.Name : string.Empty));

            // MaterialRequest Mapping
            CreateMap<MaterialRequest, BPG.Application.DTOs.MaterialRequests.MaterialRequestDto>()
                .ForMember(dest => dest.ProjectId, opt => opt.MapFrom(src => src.Phase != null ? src.Phase.ProjectId : 0))
                .ForMember(dest => dest.PhaseName, opt => opt.MapFrom(src => src.Phase != null ? src.Phase.Name : string.Empty))
                .ForMember(dest => dest.CheckedByName, opt => opt.MapFrom(src => src.Checker != null ? src.Checker.FullName : string.Empty))
                .ForMember(dest => dest.ApprovedByName, opt => opt.MapFrom(src => src.Approver != null ? src.Approver.FullName : string.Empty))
                .ForMember(dest => dest.CreatedByName, opt => opt.Ignore());

            CreateMap<MaterialRequestItem, BPG.Application.DTOs.MaterialRequests.MaterialRequestItemDto>()
                .ForMember(dest => dest.MaterialName, opt => opt.MapFrom(src => src.Material != null ? src.Material.Name : string.Empty))
                .ForMember(dest => dest.MaterialCode, opt => opt.MapFrom(src => src.Material != null ? src.Material.Code : string.Empty))
                .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit != null ? src.Unit.UnitName : string.Empty));
        }
    }
}
