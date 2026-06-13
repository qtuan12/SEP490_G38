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
        }
    }
}
