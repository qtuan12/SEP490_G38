using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.Features.Suppliers.Handlers;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.Suppliers
{
    public class DeleteSupplierCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Supplier>> _mockSupplierRepo;
        private readonly DeleteSupplierCommandHandler _handler;

        public DeleteSupplierCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockSupplierRepo = new Mock<IGenericRepository<Supplier>>();

            _mockUow.Setup(u => u.Repository<Supplier>()).Returns(_mockSupplierRepo.Object);

            _handler = new DeleteSupplierCommandHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ExistingSupplier_ShouldSoftDeleteSuccessfully()
        {
            // Arrange
            var supplier = new Supplier { SupplierId = 1, SupplierName = "Supplier A", IsDeleted = false };
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(supplier);

            var command = new DeleteSupplierCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            supplier.IsDeleted.Should().BeTrue();

            _mockSupplierRepo.Verify(r => r.Update(supplier), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_SupplierNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Supplier?)null);

            var command = new DeleteSupplierCommand(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("Supplier với ID [999] không tồn tại.");

            _mockSupplierRepo.Verify(r => r.Update(It.IsAny<Supplier>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_AlreadyDeletedSupplier_ShouldStillSetDeletedAndReturnTrue()
        {
            // Arrange
            var supplier = new Supplier { SupplierId = 1, SupplierName = "Supplier A", IsDeleted = true };
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(supplier);

            var command = new DeleteSupplierCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            supplier.IsDeleted.Should().BeTrue();

            _mockSupplierRepo.Verify(r => r.Update(supplier), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
