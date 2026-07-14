using BPG.Application.Common.Models;
using BPG.Application.DTOs.GoodsReceipts;
using BPG.Application.Features.GoodsReceipts.Handlers;
using BPG.Application.Features.GoodsReceipts.Queries;
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

namespace BPG.Application.UnitTests.GoodsReceipts
{
    public class GetGoodsReceiptsQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockGrRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly GetGoodsReceiptsQueryHandler _handler;

        public GetGoodsReceiptsQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockGrRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockGrRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User>().AsQueryable().BuildMock());

            _handler = new GetGoodsReceiptsQueryHandler(_mockUow.Object);
        }

        private List<GoodsReceipt> GetMockReceiptsList()
        {
            return new List<GoodsReceipt>
            {
                new GoodsReceipt
                {
                    ReceiptId = 1,
                    ReceiptNo = "GR-001",
                    DelivererInfo = "John Deliverer",
                    DeliveryDocNo = "DOC-A",
                    Status = "Approved",
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    CreatedBy = 10,
                    PurchaseOrder = new PurchaseOrder
                    {
                        PONumber = "PO-100",
                        Request = new MaterialRequest
                        {
                            Phase = new Phase { ProjectId = 5 }
                        }
                    }
                },
                new GoodsReceipt
                {
                    ReceiptId = 2,
                    ReceiptNo = "GR-002",
                    DelivererInfo = "Jane Deliverer",
                    DeliveryDocNo = "DOC-B",
                    Status = "Approved",
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    CreatedBy = 20,
                    PurchaseOrder = new PurchaseOrder
                    {
                        PONumber = "PO-200",
                        Request = new MaterialRequest
                        {
                            Phase = new Phase { ProjectId = 6 }
                        }
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
        public async Task UTCID01_Handle_NoFilters_ShouldReturnPagedList()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Count.Should().Be(2);
            result.TotalCount.Should().Be(2);

            result.Items[0].ReceiptNo.Should().Be("GR-001");
            result.Items[0].CreatedByName.Should().Be("Admin User");

            result.Items[1].ReceiptNo.Should().Be("GR-002");
            result.Items[1].CreatedByName.Should().Be("TM User");
        }

        [Fact]
        public async Task UTCID02_Handle_FilterByProject_ShouldReturnFilteredPagedList()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                ProjectId = 5 // project id 5 only
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].ReceiptId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID03_Handle_SearchByReceiptNo_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "GR-002"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].ReceiptId.Should().Be(2);
        }

        [Fact]
        public async Task UTCID04_Handle_SearchByPONumber_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "PO-100"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].ReceiptId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID05_Handle_SearchByDelivererInfo_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "Jane"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].ReceiptId.Should().Be(2);
        }

        [Fact]
        public async Task UTCID06_Handle_CreatedByUserNotFound_ShouldReturnNAForCreatedByName()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            receipts[0].CreatedBy = 999; // User 999 not in user list
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery { PageNumber = 1, PageSize = 10 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(2);
            result.Items[0].CreatedByName.Should().Be("N/A");
        }

        [Fact]
        public async Task UTCID07_Handle_SearchNoMatch_ShouldReturnEmptyList()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery { Search = "NonExistentName" };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().BeEmpty();
        }

        [Fact]
        public async Task UTCID08_Handle_ProjectIdNoMatch_ShouldReturnEmptyList()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery { ProjectId = 999 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().BeEmpty();
        }

        [Fact]
        public async Task UTCID09_Handle_PageNumberGreaterThanOne_ShouldReturnEmptyOrCorrectPage()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery { PageNumber = 2, PageSize = 10 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().BeEmpty(); // Since only 2 items exist and PageSize is 10, page 2 must be empty
        }

        [Fact]
        public async Task UTCID10_Handle_CombinedProjectIdAndSearch_ShouldFilterCorrectly()
        {
            // Arrange
            var receipts = GetMockReceiptsList();
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery
            {
                ProjectId = 5,
                Search = "GR-001"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().ContainSingle().Which.ReceiptId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID11_Handle_NullPurchaseOrderOrPhase_ShouldSkipOrHandleGracefully()
        {
            // Arrange
            var receipts = new List<GoodsReceipt>
            {
                new GoodsReceipt
                {
                    ReceiptId = 3,
                    ReceiptNo = "GR-003",
                    PurchaseOrder = null // Null PO
                }
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

            var query = new GetGoodsReceiptsQuery { PageNumber = 1, PageSize = 10 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().ContainSingle();
            result.Items[0].PONumber.Should().BeEmpty();
        }
    }
}
