using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace BPG.Api.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            // SignalR tự động ánh xạ UserIdentifier thông qua ClaimTypes.NameIdentifier của JWT Token
            var userId = Context.UserIdentifier;
            
            // Bạn có thể bật log hoặc làm các tác vụ khi user connect ở đây nếu cần thiết
            await base.OnConnectedAsync();
        }
    }
}
