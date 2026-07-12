using BPG.Application.Common.Models;
using BPG.Application.Features.GoodsReceipts.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
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

namespace BPG.Application.UnitTests.GoodsReceipts
{
    public class GetGoodsReceiptDetailQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockGrRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly GetGoodsReceiptDetailQueryHandler _handler;

        public GetGoodsReceiptDetailQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockGrRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockGrRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new GetGoodsReceiptDetailQueryHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidId_ShouldReturnDetails()
        {
            // Arrange
            var gr = new GoodsReceipt
            {
                ReceiptId = 500,
                ReceiptNo = "GR-001",
                POId = 100,
                DelivererInfo = "John Deliverer",
                DeliveryDocNo = "DOC-123",
                Status = "Approved",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = 10,
                PurchaseOrder = new PurchaseOrder
                {
                    PONumber = "PO-100",
                    Supplier = new Supplier { SupplierName = "Supplier Alpha" }
                },
                Items = new List<GoodsReceiptItem>
                {
                    new GoodsReceiptItem
                    {
                        ReceiptItemId = 1,
                        MaterialId = 50,
                        UnitId = 2,
                        Quantity = 10,
                        Material = new MaterialCatalog
                        {
                            Code = "MAT-001",
                            Name = "Cement",
                            Specification = "Grade 50"
                        },
                        Unit = new Unit
                        {
                            UnitName = "Bag"
                        }
                    }
                }
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { gr }.AsQueryable().BuildMock());

            // Mock attachments
            var attachments = new List<Attachment>
            {
                new Attachment
                {
                    EntityType = EntityType.GoodsReceipt,
                    EntityId = 500,
                    FileUrl = "http://file.com/photo.jpg",
                    IsDeleted = false
                }
            };
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(attachments.AsQueryable().BuildMock());

            // Mock user
            var user = new User { UserId = 10, FullName = "Admin Creator" };
            _mockUserRepo.Setup(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>())).ReturnsAsync(user);

            var query = new GetGoodsReceiptDetailQuery(500);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();

            var dto = result.Data;
            dto.ReceiptNo.Should().Be("GR-001");
            dto.SupplierName.Should().Be("Supplier Alpha");
            dto.CreatedByName.Should().Be("Admin Creator");
            dto.Images.Should().Contain("http://file.com/photo.jpg");

            dto.Items.Should().HaveCount(1);
            dto.Items[0].MaterialName.Should().Be("Cement");
            dto.Items[0].UnitName.Should().Be("Bag");
            dto.Items[0].Quantity.Should().Be(10);
        }

        [Fact]
        public async Task UTCID02_Handle_ReceiptNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt>().AsQueryable().BuildMock());

            var query = new GetGoodsReceiptDetailQuery(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("GoodsReceipt với ID [999] không tồn tại.");
        }
    }
}
