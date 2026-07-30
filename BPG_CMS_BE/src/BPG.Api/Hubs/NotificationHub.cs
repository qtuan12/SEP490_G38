using BPG.Application.IServices;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BPG.Api.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        private readonly IProjectAccessService _projectAccessService;

        public NotificationHub(IProjectAccessService projectAccessService)
        {
            _projectAccessService = projectAccessService;
        }

        public override async Task OnConnectedAsync()
        {
            // SignalR tự động ánh xạ UserIdentifier thông qua ClaimTypes.NameIdentifier của JWT Token
            var userId = Context.UserIdentifier;
            
            // Bạn có thể bật log hoặc làm các tác vụ khi user connect ở đây nếu cần thiết
            await base.OnConnectedAsync();
        }

        public async Task JoinProjectGroup(long projectId)
        {
            var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(Context.ConnectionAborted);
            if (!accessibleProjectIds.Contains(projectId))
            {
                throw new HubException("Bạn không có quyền truy cập dự án này.");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        }

        public async Task LeaveProjectGroup(long projectId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        }
    }
}

