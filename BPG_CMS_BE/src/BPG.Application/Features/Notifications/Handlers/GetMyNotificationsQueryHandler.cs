using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Notifications;
using BPG.Application.Features.Notifications.Queries;
using BPG.Application.IServices;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Notifications.Handlers
{
    public class GetMyNotificationsQueryHandler : IRequestHandler<GetMyNotificationsQuery, PagedList<NotificationDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;

        public GetMyNotificationsQueryHandler(IUnitOfWork uow, IMapper mapper, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
        }

        public async Task<PagedList<NotificationDto>> Handle(GetMyNotificationsQuery request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            var query = _uow.Repository<Notification>().Query()
                .AsNoTracking()
                .Where(n => n.UserId == currentUserId)
                .OrderByDescending(n => n.CreatedAt);

            // Phân trang danh sách entities
            var pagedEntities = await query.ToPagedListAsync(request, cancellationToken);

            // Ánh xạ sang DTO
            var dtos = _mapper.Map<List<NotificationDto>>(pagedEntities.Items);

            return new PagedList<NotificationDto>(dtos, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
        }
    }
}
