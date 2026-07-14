using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialReturns.Queries;
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

namespace BPG.Application.UnitTests.MaterialReturns
{
    public class GetMaterialReturnDetailQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialReturn>> _mockReturnRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly GetMaterialReturnDetailQueryHandler _handler;

        public GetMaterialReturnDetailQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockReturnRepo = new Mock<IGenericRepository<MaterialReturn>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialReturn>()).Returns(_mockReturnRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new GetMaterialReturnDetailQueryHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidId_ShouldReturnDetails()
        {
            // Arrange
            var mr = new MaterialReturn
            {
                MaterialReturnId = 700,
                ReturnNo = "PTRA-001",
                Reason = "Excess cement",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = 10,
                OriginalIssuanceId = 500,
                OriginalIssuance = new MaterialIssuance
                {
                    IssuanceNo = "PXK-500",
                    TaskId = 100,
                    Task = new ProjectTask { Name = "Concrete pouring" }
                },
                Items = new List<MaterialReturnItem>
                {
                    new MaterialReturnItem
                    {
                        ReturnItemId = 1,
                        MaterialId = 50,
                        UnitId = 2,
                        Quantity = 5,
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
            _mockReturnRepo.Setup(r => r.Query()).Returns(new List<MaterialReturn> { mr }.AsQueryable().BuildMock());

            // Mock user
            var user = new User { UserId = 10, FullName = "Admin User" };
            _mockUserRepo.Setup(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>())).ReturnsAsync(user);

            var query = new GetMaterialReturnDetailQuery(700);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();

            var dto = result.Data;
            dto.ReturnNo.Should().Be("PTRA-001");
            dto.OriginalIssuanceNo.Should().Be("PXK-500");
            dto.TaskName.Should().Be("Concrete pouring");
            dto.CreatedByName.Should().Be("Admin User");

            dto.Items.Should().HaveCount(1);
            dto.Items[0].MaterialName.Should().Be("Cement");
            dto.Items[0].UnitName.Should().Be("Bag");
            dto.Items[0].Quantity.Should().Be(5);

            _mockUserRepo.Verify(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_NotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockReturnRepo.Setup(r => r.Query()).Returns(new List<MaterialReturn>().AsQueryable().BuildMock());

            var query = new GetMaterialReturnDetailQuery(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("MaterialReturn với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_CreatorUserNotFound_ShouldReturnNAForCreatedByName()
        {
            // Arrange
            var mr = new MaterialReturn
            {
                MaterialReturnId = 700,
                ReturnNo = "PTRA-001",
                CreatedBy = 999, // User 999 does not exist
                Items = new List<MaterialReturnItem>()
            };
            _mockReturnRepo.Setup(r => r.Query()).Returns(new List<MaterialReturn> { mr }.AsQueryable().BuildMock());
            _mockUserRepo.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync((User)null);

            var query = new GetMaterialReturnDetailQuery(700);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.CreatedByName.Should().Be("N/A");
            _mockUserRepo.Verify(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID04_Handle_NullOriginalIssuance_ShouldMapGracefully()
        {
            // Arrange
            var mr = new MaterialReturn
            {
                MaterialReturnId = 700,
                ReturnNo = "PTRA-001",
                OriginalIssuance = null, // Null original issuance
                Items = new List<MaterialReturnItem>()
            };
            _mockReturnRepo.Setup(r => r.Query()).Returns(new List<MaterialReturn> { mr }.AsQueryable().BuildMock());

            var query = new GetMaterialReturnDetailQuery(700);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.OriginalIssuanceNo.Should().BeEmpty();
            result.Data.TaskName.Should().BeEmpty();
        }
    }
}
