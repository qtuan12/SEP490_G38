using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialIssuances.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.MaterialIssuances
{
    public class GetMaterialIssuanceDetailQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly GetMaterialIssuanceDetailQueryHandler _handler;

        public GetMaterialIssuanceDetailQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new GetMaterialIssuanceDetailQueryHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidId_ShouldReturnDetails()
        {
            // Arrange
            var mi = new MaterialIssuance
            {
                MaterialIssuanceId = 600,
                IssuanceNo = "PXK-001",
                TaskId = 100,
                Purpose = "Pour Slab",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = 10,
                Task = new ProjectTask { Name = "Concrete pouring" },
                Items = new List<MaterialIssuanceItem>
                {
                    new MaterialIssuanceItem
                    {
                        IssuanceItemId = 1,
                        MaterialId = 50,
                        UnitId = 2,
                        Quantity = 10,
                        ConversionRate = 1,
                        Material = new MaterialCatalog
                        {
                            Code = "MAT-001",
                            Name = "Cement"
                        },
                        Unit = new Unit
                        {
                            UnitName = "Bag"
                        }
                    }
                }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { mi }.AsQueryable().BuildMock());

            // Mock user
            var user = new User { UserId = 10, FullName = "Admin User" };
            _mockUserRepo.Setup(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>())).ReturnsAsync(user);

            var query = new GetMaterialIssuanceDetailQuery(600);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();

            var dto = result.Data;
            dto.IssuanceNo.Should().Be("PXK-001");
            dto.TaskName.Should().Be("Concrete pouring");
            dto.CreatedByName.Should().Be("Admin User");

            dto.Items.Should().HaveCount(1);
            dto.Items[0].MaterialName.Should().Be("Cement");
            dto.Items[0].UnitName.Should().Be("Bag");
            dto.Items[0].Quantity.Should().Be(10);

            _mockUserRepo.Verify(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_NotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance>().AsQueryable().BuildMock());

            var query = new GetMaterialIssuanceDetailQuery(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("MaterialIssuance với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_UserNotFound_ShouldNotCrash()
        {
            // Arrange
            var mi = new MaterialIssuance
            {
                MaterialIssuanceId = 600,
                IssuanceNo = "PXK-001",
                CreatedBy = 999, // User 999 does not exist
                Items = new List<MaterialIssuanceItem>()
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { mi }.AsQueryable().BuildMock());
            _mockUserRepo.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync((User)null);

            var query = new GetMaterialIssuanceDetailQuery(600);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.CreatedByName.Should().Be("N/A");
            _mockUserRepo.Verify(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID04_Handle_EmptyItemsList_ShouldReturnEmptyItems()
        {
            // Arrange
            var mi = new MaterialIssuance
            {
                MaterialIssuanceId = 600,
                IssuanceNo = "PXK-001",
                Items = new List<MaterialIssuanceItem>()
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { mi }.AsQueryable().BuildMock());

            var query = new GetMaterialIssuanceDetailQuery(600);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.Items.Should().BeEmpty();
        }
    }
}
