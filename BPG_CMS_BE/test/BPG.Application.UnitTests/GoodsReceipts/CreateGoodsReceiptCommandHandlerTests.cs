using BPG.Application.Common.Models;
using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.Features.GoodsReceipts.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
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
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.GoodsReceipts
{
    public class CreateGoodsReceiptCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockGrRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockGrItemRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly CreateGoodsReceiptCommandHandler _handler;

        public CreateGoodsReceiptCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockGrRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockGrItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockInventoryService = new Mock<IInventoryService>();

            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockGrRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceiptItem>()).Returns(_mockGrItemRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);

            // Default Query Mock setups
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder>().AsQueryable().BuildMock());
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt>().AsQueryable().BuildMock());
            _mockGrItemRepo.Setup(r => r.Query()).Returns(new List<GoodsReceiptItem>().AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            // Default AddAsync setups
            _mockGrRepo.Setup(r => r.AddAsync(It.IsAny<GoodsReceipt>(), It.IsAny<CancellationToken>()))
                .Callback<GoodsReceipt, CancellationToken>((gr, ct) => gr.ReceiptId = 500)
                .Returns(Task.CompletedTask);

            _handler = new CreateGoodsReceiptCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockInventoryService.Object
            );
        }

        private void SetupCurrentUser(long userId)
        {
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(userId);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_FullyReceived_ShouldCreateGoodsReceiptSuccessfully()
        {
            // Arrange
            SetupCurrentUser(10);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                PONumber = "PO-100",
                Request = new MaterialRequest
                {
                    Phase = new Phase
                    {
                        Project = project
                    }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem
                    {
                        MaterialId = 50,
                        Quantity = 10,
                        ConversionRate = 1,
                        Material = new MaterialCatalog { Name = "Cement" }
                    }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var items = new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(MaterialId: 50, UnitId: 1, Quantity: 10) // Full quantity
            };
            var command = new CreateGoodsReceiptCommand(
                POId: 100,
                DelivererInfo: "John Doe",
                DeliveryDocNo: "DOC-123",
                Items: items,
                Images: new List<string> { "http://file.com/photo.jpg" }
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().Be(500); // Set by callback

            po.Status.Should().Be(PurchaseOrderStatus.FullyReceived);

            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockGrRepo.Verify(r => r.AddAsync(It.Is<GoodsReceipt>(g => g.POId == 100 && g.DelivererInfo == "John Doe"), It.IsAny<CancellationToken>()), Times.Once);
            _mockGrItemRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<GoodsReceiptItem>>(l => l.First().MaterialId == 50), It.IsAny<CancellationToken>()), Times.Once);
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<Attachment>>(l => l.First().FileUrl == "http://file.com/photo.jpg"), It.IsAny<CancellationToken>()), Times.Once);
            _mockInventoryService.Verify(s => s.UpdateStockAsync(5, 50, 10, InventoryTransactionType.GoodsReceipt, It.IsAny<long>(), EntityType.GoodsReceipt, 10, It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_ValidRequest_PartiallyReceived_ShouldCreateGoodsReceiptSuccessfully()
        {
            // Arrange
            SetupCurrentUser(10);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                PONumber = "PO-100",
                Request = new MaterialRequest
                {
                    Phase = new Phase
                    {
                        Project = project
                    }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem
                    {
                        MaterialId = 50,
                        Quantity = 10,
                        ConversionRate = 1,
                        Material = new MaterialCatalog { Name = "Cement" }
                    }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var items = new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(MaterialId: 50, UnitId: 1, Quantity: 4) // Partial quantity (4 out of 10)
            };
            var command = new CreateGoodsReceiptCommand(
                POId: 100,
                DelivererInfo: "John Doe",
                DeliveryDocNo: "DOC-123",
                Items: items
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            po.Status.Should().Be(PurchaseOrderStatus.PartiallyReceived);
        }

        [Fact]
        public async Task UTCID03_Handle_EmptyItemsList_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Danh sách vật tư nhận thực tế không được để trống.");
        }

        [Fact]
        public async Task UTCID04_Handle_PurchaseOrderNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(10);

            var command = new CreateGoodsReceiptCommand(999, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("PurchaseOrder với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID05_Handle_ProjectNotFound_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var po = new PurchaseOrder
            {
                POId = 100,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = null } // No project!
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy dự án liên kết với đơn mua hàng này.");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.Completed }; // Closed project!
            var po = new PurchaseOrder
            {
                POId = 100,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage(ValidationMessages.ProjectNotActive);
        }

        [Fact]
        public async Task UTCID07_Handle_InvalidPOStatus_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Closed, // Invalid status!
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể nhập kho cho đơn hàng có trạng thái*");
        }

        [Fact]
        public async Task UTCID08_Handle_MaxImagesExceeded_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, Material = new MaterialCatalog { Name = "Cement" } }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var tooManyImages = new List<string> { "1", "2", "3", "4", "5", "6" }; // 6 images
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            }, tooManyImages);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Tối đa chỉ được đính kèm 5 hình ảnh chứng từ giao nhận.");
        }

        [Fact]
        public async Task UTCID09_Handle_MaterialNotInPO_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50 }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            // Asking to receive material 99 (not in PO)
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(99, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Vật tư ID 99 không tồn tại trong đơn hàng PO này.");
        }

        [Fact]
        public async Task UTCID10_Handle_InvalidQuantityLessThanZero_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Material = new MaterialCatalog { Name = "Cement" } }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            // Quantity is 0
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 0)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Số lượng nhận của vật tư [Cement] phải lớn hơn 0.");
        }

        [Fact]
        public async Task UTCID11_Handle_QuantityExceededRemaining_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, Material = new MaterialCatalog { Name = "Cement" } }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            // GroupBy received list (user has already received 6 of material 50)
            var existingReceiptItems = new List<GoodsReceiptItem>
            {
                new GoodsReceiptItem
                {
                    MaterialId = 50,
                    Quantity = 6,
                    Receipt = new GoodsReceipt { POId = 100, Status = GoodsReceiptStatus.Approved }
                }
            };
            _mockGrItemRepo.Setup(r => r.Query()).Returns(existingReceiptItems.AsQueryable().BuildMock());

            // Requesting to receive 5 more (6 + 5 = 11 > 10, which exceeds by 1)
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Số lượng nhận (5) vượt quá số lượng còn lại cần giao của PO cho vật tư [Cement] (còn thiếu 4).");
        }

        [Fact]
        public async Task UTCID12_Handle_Exactly5Images_ShouldCreateGoodsReceiptSuccessfully()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, Material = new MaterialCatalog { Name = "Cement" } }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var fiveImages = new List<string> { "img1", "img2", "img3", "img4", "img5" };
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            }, fiveImages);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<Attachment>>(l => l.Count() == 5), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID13_Handle_MultipleItemsOneInvalid_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, Material = new MaterialCatalog { Name = "Cement" } },
                    new PurchaseOrderItem { MaterialId = 51, Quantity = 10, Material = new MaterialCatalog { Name = "Sand" } }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var items = new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5),
                new CreateGoodsReceiptItemDto(51, 1, 0) // Invalid: Qty = 0
            };
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", items);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Số lượng nhận của vật tư [Sand] phải lớn hơn 0.");
        }

        [Fact]
        public async Task UTCID14_Handle_POWithMultipleItemsPartiallyReceived_ShouldUpdatePOStatusToPartiallyReceived()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, Material = new MaterialCatalog { Name = "Cement" } },
                    new PurchaseOrderItem { MaterialId = 51, Quantity = 10, Material = new MaterialCatalog { Name = "Sand" } }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            var items = new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 10), // Cement fully received
                new CreateGoodsReceiptItemDto(51, 1, 5)   // Sand partially received (5/10)
            };
            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", items);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            po.Status.Should().Be(PurchaseOrderStatus.PartiallyReceived);
        }

        [Fact]
        public async Task UTCID15_Handle_ExceptionDuringStockUpdate_ShouldRollbackTransactionAndThrow()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.Sent,
                Request = new MaterialRequest
                {
                    Phase = new Phase { Project = project }
                },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, Material = new MaterialCatalog { Name = "Cement" } }
                }
            };
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder> { po }.AsQueryable().BuildMock());

            _mockInventoryService.Setup(s => s.UpdateStockAsync(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<decimal>(), It.IsAny<byte>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("Database connection failed"));

            var command = new CreateGoodsReceiptCommand(100, "John", "DOC-123", new List<CreateGoodsReceiptItemDto>
            {
                new CreateGoodsReceiptItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<Exception>().WithMessage("Database connection failed");
            _mockUow.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
