using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>Xóa mềm phiếu nháp. Chỉ người tạo và chỉ khi Status = Draft.</summary>
    public record DeleteDirectPurchaseDraftCommand(long DirectPurchaseId) : IRequest<bool>;
}
