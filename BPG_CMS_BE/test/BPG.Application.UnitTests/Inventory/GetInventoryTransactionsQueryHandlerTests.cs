using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using BPG.Application.Features.Inventory.Handlers;
using BPG.Application.Features.Inventory.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
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

namespace BPG.Application.UnitTests.Inventory
{
    public class GetInventoryTransactionsQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<InventoryTransaction>> _mockTxRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly GetInventoryTransactionsQueryHandler _handler;

        public GetInventoryTransactionsQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockTxRepo = new Mock<IGenericRepository<InventoryTransaction>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<InventoryTransaction>()).Returns(_mockTxRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new GetInventoryTransactionsQueryHandler(_mockUow.Object);
        }

        private List<InventoryTransaction> GetMockTxList()
        {
            var unit = new Unit { UnitName = "Bag" };
            return new List<InventoryTransaction>
            {
                new InventoryTransaction
                {
                    TransactionId = 1,
                    ProjectId = 5,
                    MaterialId = 50,
                    TransactionType = 1, // GoodsReceipt
                    ReferenceId = 100,
                    QuantityChange = 50,
                    BalanceAfter = 50,
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    CreatedBy = 10,
                    Material = new MaterialCatalog
                    {
                        Code = "MAT-50",
                        Name = "Cement",
                        BaseUnit = unit
                    }
                },
                new InventoryTransaction
                {
                    TransactionId = 2,
                    ProjectId = 5,
                    MaterialId = 60,
                    TransactionType = 2, // Issuance
                    ReferenceId = 200,
                    QuantityChange = -10,
                    BalanceAfter = 15,
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    CreatedBy = 20,
                    Material = new MaterialCatalog
                    {
                        Code = "MAT-60",
                        Name = "Brick",
                        BaseUnit = unit
                    }
                }
            };
        }

        private List<User> GetMockUsersList()
        {
            return new List<User>
            {
                new User { UserId = 10, FullName = "Admin User" },
                new User { UserId = 20, FullName = "TM User" }
            };
        }

        [Fact]
        public async Task UTCID01_Handle_NoFilters_ShouldReturnPagedTransactions()
        {
            // Arrange
            var txs = GetMockTxList();
            _mockTxRepo.Setup(r => r.Query()).Returns(txs.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetInventoryTransactionsQuery
            {
                ProjectId = 5,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Count.Should().Be(2);
            result.TotalCount.Should().Be(2);

            result.Items[0].TransactionId.Should().Be(1);
            result.Items[0].CreatedByName.Should().Be("Admin User");

            result.Items[1].TransactionId.Should().Be(2);
            result.Items[1].CreatedByName.Should().Be("TM User");
        }

        [Fact]
        public async Task UTCID02_Handle_FilterByMaterial_ShouldReturnFilteredTransactions()
        {
            // Arrange
            var txs = GetMockTxList();
            _mockTxRepo.Setup(r => r.Query()).Returns(txs.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetInventoryTransactionsQuery
            {
                ProjectId = 5,
                MaterialId = 50,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialId.Should().Be(50);
        }

        [Fact]
        public async Task UTCID03_Handle_FilterByTransactionType_ShouldReturnFilteredTransactions()
        {
            // Arrange
            var txs = GetMockTxList();
            _mockTxRepo.Setup(r => r.Query()).Returns(txs.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetInventoryTransactionsQuery
            {
                ProjectId = 5,
                TransactionType = 2, // Issuance
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].TransactionId.Should().Be(2);
        }

        [Fact]
        public async Task UTCID04_Handle_SearchByMaterialName_ShouldReturnMatchingTransactions()
        {
            // Arrange
            var txs = GetMockTxList();
            _mockTxRepo.Setup(r => r.Query()).Returns(txs.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetInventoryTransactionsQuery
            {
                ProjectId = 5,
                Search = "cement",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialName.Should().Be("Cement");
        }

        [Fact]
        public async Task UTCID05_Handle_SearchByMaterialCode_ShouldReturnMatchingTransactions()
        {
            // Arrange
            var txs = GetMockTxList();
            _mockTxRepo.Setup(r => r.Query()).Returns(txs.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetInventoryTransactionsQuery
            {
                ProjectId = 5,
                Search = "MAT-60",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialCode.Should().Be("MAT-60");
        }
    }
}
