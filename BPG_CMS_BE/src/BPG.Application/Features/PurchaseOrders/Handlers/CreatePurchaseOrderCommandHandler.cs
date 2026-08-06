using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.Features.PurchaseOrders.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    public class CreatePurchaseOrderCommandHandler : IRequestHandler<CreatePurchaseOrderCommand, long>
    {
        private readonly IUnitOfWork _uow;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;
        private readonly ICurrentUserService _currentUserService;

        public CreatePurchaseOrderCommandHandler(
            IUnitOfWork uow,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService,
            ICurrentUserService currentUserService)
        {
            _uow = uow;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
            _currentUserService = currentUserService;
        }

        public async Task<long> Handle(CreatePurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            // 1. Load and validate the linked request
            var linkedRequest = await _uow.Repository<MaterialRequest>().Query()
                .AsNoTracking()
                .Include(r => r.Items).ThenInclude(i => i.Material).ThenInclude(m => m!.BaseUnit)
                .Include(r => r.Phase)
                .FirstOrDefaultAsync(r => r.RequestId == request.RequestId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy yêu cầu vật tư đã chọn.");

            if (linkedRequest.Status != MaterialRequestStatus.Approved)
                throw new BusinessException(ErrorCodes.PoRequestNotApproved, "Yêu cầu vật tư chưa được duyệt.");

            // 1b. Validate ngày PO và hạn giao hàng.
            // Không bắt buộc nằm trong khoảng của giai đoạn: chỉ cần không sớm hơn ngày bắt đầu dự án
            // và không vượt quá ngày kết thúc giai đoạn (mua trước cho giai đoạn sau là hợp lệ).
            var phase = linkedRequest.Phase;
            var orderDateOnly = DateOnly.FromDateTime(request.OrderDate.Date);

            var project = await _uow.Repository<Project>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy dự án của đơn hàng.");

            if (orderDateOnly < project.PlannedStart)
                throw new BusinessException(ErrorCodes.PoOrderDateBeforeProject,
                    $"Ngày đơn hàng ({orderDateOnly:dd/MM/yyyy}) phải từ ngày bắt đầu dự án '{project.Name}' ({project.PlannedStart:dd/MM/yyyy}) trở đi.");

            if (phase.EndDate.HasValue && orderDateOnly > phase.EndDate.Value)
                throw new BusinessException(ErrorCodes.PoOrderDateAfterPhase,
                    $"Ngày đơn hàng ({orderDateOnly:dd/MM/yyyy}) vượt quá ngày kết thúc giai đoạn '{phase.Name}' ({phase.EndDate.Value:dd/MM/yyyy}).");

            if (request.ExpectedDeliveryDate.HasValue)
            {
                var deliveryDate = request.ExpectedDeliveryDate.Value;

                if (deliveryDate < project.PlannedStart)
                    throw new BusinessException(ErrorCodes.PoDeliveryDateBeforeProject,
                        $"Hạn giao hàng ({deliveryDate:dd/MM/yyyy}) phải từ ngày bắt đầu dự án '{project.Name}' ({project.PlannedStart:dd/MM/yyyy}) trở đi.");

                if (phase.EndDate.HasValue && deliveryDate > phase.EndDate.Value)
                    throw new BusinessException(ErrorCodes.PoDeliveryDateAfterPhase,
                        $"Hạn giao hàng ({deliveryDate:dd/MM/yyyy}) vượt quá ngày kết thúc giai đoạn '{phase.Name}' ({phase.EndDate.Value:dd/MM/yyyy}).");
            }

            // 2. Validate quantities: PO qty + đã đặt qua các PO còn hiệu lực ≤ số lượng yêu cầu
            var maxQtyByMaterial = linkedRequest.Items
                .GroupBy(i => i.MaterialId)
                .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

            var materialNames = linkedRequest.Items
                .GroupBy(i => i.MaterialId)
                .ToDictionary(g => g.Key, g => g.First().Material?.Name ?? $"#{g.Key}");

            // Số lượng đã đặt cho yêu cầu này qua các PO còn hiệu lực (không tính PO đã hủy hoặc bị
            // Giám đốc từ chối). PO đã đóng (Closed) chỉ còn giữ chỗ phần ĐÃ NHẬN thực tế — phần chưa
            // nhận được giải phóng trở lại yêu cầu vật tư để có thể tạo PO khác.
            var poItemRows = await _uow.Repository<PurchaseOrderItem>().Query()
                .AsNoTracking()
                .Where(pi => pi.PurchaseOrder.RequestId == request.RequestId
                          && pi.PurchaseOrder.Status != PurchaseOrderStatus.Cancelled
                          && pi.PurchaseOrder.Status != PurchaseOrderStatus.Rejected)
                .Select(pi => new { pi.POId, pi.MaterialId, pi.Quantity, POStatus = pi.PurchaseOrder.Status })
                .ToListAsync(cancellationToken);

            var closedPOIds = poItemRows
                .Where(x => x.POStatus == PurchaseOrderStatus.Closed)
                .Select(x => x.POId)
                .Distinct()
                .ToList();

            var receivedByClosedPO = closedPOIds.Count == 0
                ? new Dictionary<(long POId, long MaterialId), decimal>()
                : (await _uow.Repository<GoodsReceiptItem>().Query()
                    .AsNoTracking()
                    .Where(gri => closedPOIds.Contains(gri.Receipt.POId) && gri.Receipt.Status == GoodsReceiptStatus.Approved)
                    .GroupBy(gri => new { gri.Receipt.POId, gri.MaterialId })
                    .Select(g => new { g.Key.POId, g.Key.MaterialId, Received = g.Sum(x => x.Quantity) })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(x => (x.POId, x.MaterialId), x => x.Received);

            var orderedByMaterial = poItemRows
                .GroupBy(x => x.MaterialId)
                .ToDictionary(g => g.Key, g => g.Sum(x =>
                {
                    if (x.POStatus != PurchaseOrderStatus.Closed) return x.Quantity;
                    receivedByClosedPO.TryGetValue((x.POId, x.MaterialId), out var received);
                    return Math.Min(x.Quantity, received);
                }));

            foreach (var item in request.Items)
            {
                if (!maxQtyByMaterial.TryGetValue(item.MaterialId, out var requestedQty))
                    throw new BusinessException(ErrorCodes.PoMaterialNotInRequest,
                        $"Vật tư (MaterialId={item.MaterialId}) không thuộc yêu cầu vật tư đã chọn.");

                orderedByMaterial.TryGetValue(item.MaterialId, out var alreadyOrdered);
                var remaining = requestedQty - alreadyOrdered;

                if (item.Quantity > remaining)
                    throw new BusinessException(ErrorCodes.PoQtyExceedsRequest,
                        $"Vật tư '{materialNames[item.MaterialId]}' vượt số lượng yêu cầu. " +
                        $"Đã yêu cầu {requestedQty}, đã đặt {alreadyOrdered} qua các đơn hàng trước, " +
                        $"chỉ còn được đặt tối đa {(remaining < 0 ? 0 : remaining)}.");

                var reqItem = linkedRequest.Items.FirstOrDefault(ri => ri.MaterialId == item.MaterialId);
                var material = reqItem?.Material;
                if (material?.BaseUnit != null && material.BaseUnit.IsDiscrete && item.Quantity % 1 != 0)
                {
                    throw new BusinessException(ErrorCodes.InvalidUnitQuantity,
                        $"Đơn vị tính '{material.BaseUnit.UnitName}' của vật tư [{material.Name}] yêu cầu số lượng đặt hàng phải là số nguyên.");
                }
            }

            // 3. Sinh mã PO và ghi đơn hàng trong một transaction.
            // Mã tự sinh dựa trên số thứ tự lớn nhất trong ngày nên hai người tạo cùng lúc sẽ đọc
            // ra cùng một số. Khóa theo ngày bằng sp_getapplock để tuần tự hóa đúng nhóm đó —
            // cùng cách CreateDailyLogCommandHandler chống tranh chấp tiến độ.
            var totalAmount = request.Items.Sum(i => i.Quantity * i.UnitPrice);
            var manualPoNumber = request.PONumber?.Trim();
            PurchaseOrder po;

            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                string poNumber;
                if (string.IsNullOrEmpty(manualPoNumber))
                {
                    var lockResource = PoNumberGenerator.LockResource(request.OrderDate);
                    await _uow.ExecuteSqlAsync(
                        $"EXEC sp_getapplock @Resource = {lockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction'",
                        cancellationToken);

                    poNumber = await PoNumberGenerator.NextAsync(_uow, request.OrderDate, cancellationToken);
                }
                else
                {
                    if (await PoNumberGenerator.ExistsAsync(_uow, manualPoNumber, cancellationToken))
                        throw new BusinessException(ErrorCodes.PoNumberExists, $"Số đơn hàng '{manualPoNumber}' đã tồn tại trong hệ thống.");

                    poNumber = manualPoNumber;
                }

                po = new PurchaseOrder
                {
                    PONumber = poNumber,
                    RequestId = request.RequestId,
                    ProjectId = request.ProjectId,
                    SupplierId = request.SupplierId,
                    OrderDate = request.OrderDate,
                    ExpectedDeliveryDate = request.ExpectedDeliveryDate,
                    DeliveryAddress = request.DeliveryAddress?.Trim(),
                    Notes = request.Notes?.Trim(),
                    TotalAmount = totalAmount,
                    // Mọi đơn hàng đều phải qua Giám đốc duyệt trước khi gửi nhà cung cấp / nhập kho.
                    Status = PurchaseOrderStatus.PendingApproval,
                };

                await _uow.Repository<PurchaseOrder>().AddAsync(po, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);

                // 4. Create PO items
                var poItems = request.Items.Select(i => new PurchaseOrderItem
                {
                    POId = po.POId,
                    MaterialId = i.MaterialId,
                    UnitId = i.UnitId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    LineTotal = i.Quantity * i.UnitPrice,
                    ConversionRate = i.ConversionRate,
                    Notes = i.Notes?.Trim()
                }).ToList();

                await _uow.Repository<PurchaseOrderItem>().AddRangeAsync(poItems, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);

                await _uow.CommitTransactionAsync(cancellationToken);
            }
            catch
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }

            await _realtimeSender.SendToGroupAsync(
                $"Project_{request.ProjectId}", "PurchaseOrderUpdated", new { POId = po.POId }, cancellationToken);

            // Giám đốc là người phải hành động tiếp theo (duyệt/từ chối), trưởng dự án được báo để theo dõi vật tư.
            var currentUserId = _currentUserService.UserId;
            var notiTitle = "Đơn hàng mới chờ duyệt";
            var notiContent = $"Đơn hàng {po.PONumber} cho giai đoạn '{phase.Name}' đang chờ Giám đốc duyệt. Tổng giá trị: {totalAmount:N0}đ.";

            await _notificationService.SendNotificationToRoleAsync(
                UserRole.Director, notiTitle, notiContent,
                NotificationType.Procurement, NotificationLink.ProjectPurchaseOrders(po.ProjectId), po.POId, cancellationToken);

            var projectLeaderId = await _uow.Repository<ProjectMember>().Query()
                .Where(m => m.ProjectId == request.ProjectId && m.IsLeader && m.UserId != currentUserId)
                .Select(m => m.UserId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectLeaderId > 0)
                await _notificationService.SendNotificationAsync(
                    projectLeaderId, notiTitle, notiContent,
                    NotificationType.Procurement, NotificationLink.ProjectPurchaseOrders(po.ProjectId), po.POId, cancellationToken);

            return po.POId;
        }
    }
}
