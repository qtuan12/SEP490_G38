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
            // SignalR tá»± Ä‘á»™ng Ã¡nh xáº¡ UserIdentifier thÃ´ng qua ClaimTypes.NameIdentifier cá»§a JWT Token
            var userId = Context.UserIdentifier;
            
            // Báº¡n cÃ³ thá»ƒ báº­t log hoáº·c lÃ m cÃ¡c tÃ¡c vá»¥ khi user connect á»Ÿ Ä‘Ã¢y náº¿u cáº§n thiáº¿t
            await base.OnConnectedAsync();
        }

        public async Task JoinProjectGroup(long projectId)
        {
            var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(Context.ConnectionAborted);
            if (!accessibleProjectIds.Contains(projectId))
            {
                throw new HubException("Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y.");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        }

        public async Task LeaveProjectGroup(long projectId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        }
    }
}

