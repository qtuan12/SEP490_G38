using BPG.Application.IServices;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BPG.Api.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        private readonly IPermissionService _permissionService;

        public NotificationHub(IPermissionService permissionService)
        {
            _permissionService = permissionService;
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
            if (!await _permissionService.HasProjectPermissionAsync(
                    projectId,
                    ProjectPermission.View,
                    Context.ConnectionAborted))
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
