using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>Giám đốc duyệt chi phiếu mua trực tiếp - bước cuối của mọi phiếu, dù có vượt định mức hay không.</summary>
    public class ApproveDirectPurchaseByDirectorCommand : IRequest<bool>
    {
        public long DirectPurchaseId { get; set; }
        public string? ApprovalNote { get; set; }
    }

    /// <summary>Giám đốc từ chối duyệt chi. Vật tư vẫn đã nhập kho, chỉ là không hoàn tiền.</summary>
    public class RejectDirectPurchaseByDirectorCommand : IRequest<bool>
    {
        public long DirectPurchaseId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }
}
