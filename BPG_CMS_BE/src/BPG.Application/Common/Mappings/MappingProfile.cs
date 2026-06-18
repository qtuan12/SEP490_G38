using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Domain.Entities;
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
                        ? src.UserRoles.FirstOrDefault()!.Role!.RoleName 
                        : string.Empty))
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.IsActive ? "Active" : "Inactive"));

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

            // Mapping cho Daily Log và Comments
            CreateMap<Comment, BPG.Application.DTOs.DailyLogs.CommentDto>()
                .ForMember(dest => dest.AuthorName, opt => opt.MapFrom(src => src.Author != null ? src.Author.FullName : string.Empty))
                .ForMember(dest => dest.AuthorRole, opt => opt.MapFrom(src =>
                    src.Author != null && src.Author.UserRoles != null && src.Author.UserRoles.Any() && src.Author.UserRoles.FirstOrDefault()!.Role != null
                        ? src.Author.UserRoles.FirstOrDefault()!.Role!.RoleName
                        : string.Empty));

            CreateMap<DailyLog, BPG.Application.DTOs.DailyLogs.DailyLogDto>()
                .ForMember(dest => dest.TaskName, opt => opt.MapFrom(src => src.Task != null ? src.Task.Name : string.Empty))
                .ForMember(dest => dest.CreatorName, opt => opt.MapFrom(src => src.Creator != null ? src.Creator.FullName : string.Empty))
                .ForMember(dest => dest.Images, opt => opt.Ignore())
                .ForMember(dest => dest.Comments, opt => opt.MapFrom(src => src.Comments));

            // Mapping cho TaskProgressLog
            CreateMap<TaskProgressLog, BPG.Application.DTOs.DailyLogs.TaskProgressLogDto>();

            // Mapping cho Supplier
            CreateMap<Supplier, BPG.Application.DTOs.Suppliers.SupplierDto>().ReverseMap();

            // Mapping cho MaterialCategory
            CreateMap<MaterialCategory, BPG.Application.Features.MaterialCategories.DTOs.MaterialCategoryDto>().ReverseMap();

            // Mapping cho MaterialCatalog
            CreateMap<MaterialCatalog, BPG.Application.Features.MaterialCatalogs.DTOs.MaterialCatalogDto>()
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
                .ForMember(dest => dest.Role, opt => opt.MapFrom(src => 
                    src.User != null && src.User.UserRoles != null && src.User.UserRoles.Any() && src.User.UserRoles.FirstOrDefault()!.Role != null
                        ? src.User.UserRoles.FirstOrDefault()!.Role!.RoleName 
                        : string.Empty));

            CreateMap<Attachment, BPG.Application.Features.Projects.DTOs.AttachmentDto>();
        }
    }
}
