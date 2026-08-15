using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.Features.Suppliers.Handlers;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Suppliers;

public class DeleteSupplierCommandHandlerTests
{
    [Fact]
    public async Task Handle_SupplierHasActivePurchaseOrder_ShouldRejectDeletion()
    {
        var (handler, _, poRepository, _) = CreateHandler(new Supplier { SupplierId = 10 });
        poRepository.Setup(repo => repo.Query()).Returns(new List<PurchaseOrder>
        {
            new() { POId = 1, SupplierId = 10, Status = PurchaseOrderStatus.PartiallyReceived }
        }.AsQueryable().BuildMock());

        var action = () => handler.Handle(new DeleteSupplierCommand(10), CancellationToken.None);

        var exception = await action.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_SUPPLIER_HAS_ACTIVE_ORDERS");
    }

    [Fact]
    public async Task Handle_SupplierOnlyHasCompletedOrders_ShouldSoftDeleteSupplier()
    {
        var supplier = new Supplier { SupplierId = 10 };
        var (handler, supplierRepository, poRepository, uow) = CreateHandler(supplier);
        poRepository.Setup(repo => repo.Query()).Returns(new List<PurchaseOrder>
        {
            new() { POId = 1, SupplierId = 10, Status = PurchaseOrderStatus.FullyReceived }
        }.AsQueryable().BuildMock());

        var result = await handler.Handle(new DeleteSupplierCommand(10), CancellationToken.None);

        result.Should().BeTrue();
        supplier.IsDeleted.Should().BeTrue();
        supplierRepository.Verify(repo => repo.Update(supplier), Times.Once);
        uow.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private static (
        DeleteSupplierCommandHandler Handler,
        Mock<IGenericRepository<Supplier>> SupplierRepository,
        Mock<IGenericRepository<PurchaseOrder>> PurchaseOrderRepository,
        Mock<IUnitOfWork> UnitOfWork) CreateHandler(Supplier supplier)
    {
        var uow = new Mock<IUnitOfWork>();
        var supplierRepository = new Mock<IGenericRepository<Supplier>>();
        var poRepository = new Mock<IGenericRepository<PurchaseOrder>>();
        supplierRepository.Setup(repo => repo.GetByIdAsync(supplier.SupplierId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(supplier);
        uow.Setup(unit => unit.Repository<Supplier>()).Returns(supplierRepository.Object);
        uow.Setup(unit => unit.Repository<PurchaseOrder>()).Returns(poRepository.Object);
        uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return (new DeleteSupplierCommandHandler(uow.Object), supplierRepository, poRepository, uow);
    }
}
