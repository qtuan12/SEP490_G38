using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialReturns.Commands;
using BPG.Application.Features.MaterialReturns.Handlers;
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
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.MaterialReturns
{
    public class CreateMaterialReturnCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<MaterialReturn>> _mockReturnRepo;
        private readonly Mock<IGenericRepository<MaterialReturnItem>> _mockReturnItemRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly CreateMaterialReturnCommandHandler _handler;

        public CreateMaterialReturnCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockReturnRepo = new Mock<IGenericRepository<MaterialReturn>>();
            _mockReturnItemRepo = new Mock<IGenericRepository<MaterialReturnItem>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockInventoryService = new Mock<IInventoryService>();

            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturn>()).Returns(_mockReturnRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturnItem>()).Returns(_mockReturnItemRepo.Object);

            // Default Query Mock setups
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance>().AsQueryable().BuildMock());
            _mockReturnRepo.Setup(r => r.Query()).Returns(new List<MaterialReturn>().AsQueryable().BuildMock());
            _mockReturnItemRepo.Setup(r => r.Query()).Returns(new List<MaterialReturnItem>().AsQueryable().BuildMock());

            // Default AddAsync setups
            _mockReturnRepo.Setup(r => r.AddAsync(It.IsAny<MaterialReturn>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialReturn, CancellationToken>((mr, ct) => mr.MaterialReturnId = 700)
                .Returns(Task.CompletedTask);

            _handler = new CreateMaterialReturnCommandHandler(
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
        public async Task UTCID01_Handle_ValidRequest_ShouldCreateMaterialReturnSuccessfully()
        {
            // Arrange
            SetupCurrentUser(10);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask { TaskId = 100, Phase = new Phase { Project = project } };
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                IssuanceNo = "PXK-500",
                Task = task,
                Items = new List<MaterialIssuanceItem>
                {
                    new MaterialIssuanceItem { MaterialId = 50, Quantity = 30, ConversionRate = 1 }
                }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            // No previous returns
            _mockReturnItemRepo.Setup(r => r.Query()).Returns(new List<MaterialReturnItem>().AsQueryable().BuildMock());

            var items = new List<ReturnItemDto>
            {
                new ReturnItemDto(MaterialId: 50, UnitId: 1, Quantity: 10, ConversionRate: 1)
            };
            var command = new CreateMaterialReturnCommand(OriginalIssuanceId: 500, Reason: "Excess cement", Items: items);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().Be(700); // Callback ID

            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockReturnRepo.Verify(r => r.AddAsync(It.Is<MaterialReturn>(mr => mr.OriginalIssuanceId == 500 && mr.Reason == "Excess cement"), It.IsAny<CancellationToken>()), Times.Once);
            _mockInventoryService.Verify(s => s.UpdateStockAsync(5, 50, 10, InventoryTransactionType.IssuanceReturn, 700, EntityType.MaterialReturn, 10, It.IsAny<CancellationToken>()), Times.Once);
            _mockReturnItemRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<MaterialReturnItem>>(l => l.First().MaterialId == 50), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_EmptyItemsList_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Danh sách vật tư hoàn trả không được để trống.");
        }

        [Fact]
        public async Task UTCID03_Handle_OriginalIssuanceNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(10);
            var command = new CreateMaterialReturnCommand(999, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("MaterialIssuance với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotFound_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                Task = new ProjectTask { Phase = new Phase { Project = null } } // No project!
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy dự án liên kết với phiếu xuất kho này.");
        }

        [Fact]
        public async Task UTCID05_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.Completed }; // Inactive
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                Task = new ProjectTask { Phase = new Phase { Project = project } }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án phải ở trạng thái đang tiến hành để hoàn trả vật tư.");
        }

        [Fact]
        public async Task UTCID06_Handle_MaterialNotInOriginalIssuance_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                IssuanceNo = "PXK-500",
                Task = new ProjectTask { Phase = new Phase { Project = project } },
                Items = new List<MaterialIssuanceItem>
                {
                    new MaterialIssuanceItem { MaterialId = 50, Quantity = 30 }
                }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            // Asking to return material 99 (not in issuance)
            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(99, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Vật tư ID 99 không có trong phiếu xuất kho gốc #PXK-500. Chỉ được hoàn trả vật tư đã xuất.");
        }

        [Fact]
        public async Task UTCID07_Handle_InvalidQuantityLessThanZero_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                Task = new ProjectTask { Phase = new Phase { Project = project } },
                Items = new List<MaterialIssuanceItem>
                {
                    new MaterialIssuanceItem { MaterialId = 50, Quantity = 30 }
                }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            // Quantity is 0
            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(50, 1, 0)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Số lượng hoàn trả phải lớn hơn 0.");
        }

        [Fact]
        public async Task UTCID08_Handle_ReturnQuantityExceedsIssued_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                IssuanceNo = "PXK-500",
                Task = new ProjectTask { Phase = new Phase { Project = project } },
                Items = new List<MaterialIssuanceItem>
                {
                    new MaterialIssuanceItem { MaterialId = 50, Quantity = 10, ConversionRate = 1 }
                }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            // Quantity is 15 (exceeds 10)
            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(50, 1, 15)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Số lượng hoàn trả (15*) vượt quá giới hạn còn lại có thể trả (10*) cho vật tư ID 50*");
        }

        [Fact]
        public async Task UTCID09_Handle_CumulativeReturnQuantityExceedsIssued_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                IssuanceNo = "PXK-500",
                Task = new ProjectTask { Phase = new Phase { Project = project } },
                Items = new List<MaterialIssuanceItem>
                {
                    new MaterialIssuanceItem { MaterialId = 50, Quantity = 10, ConversionRate = 1 }
                }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            // Previous returns: already returned 6
            var previousReturnedItems = new List<MaterialReturnItem>
            {
                new MaterialReturnItem
                {
                    MaterialId = 50,
                    Quantity = 6,
                    ConversionRate = 1,
                    Return = new MaterialReturn { OriginalIssuanceId = 500, IsDeleted = false }
                }
            };
            _mockReturnItemRepo.Setup(r => r.Query()).Returns(previousReturnedItems.AsQueryable().BuildMock());

            // Requesting to return 5 more (6 + 5 = 11 > 10, which exceeds by 1)
            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(50, 1, 5)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Số lượng hoàn trả (5*) vượt quá giới hạn còn lại có thể trả (4*) cho vật tư ID 50*");
        }

        [Fact]
        public async Task UTCID10_Handle_ValidCumulativeReturn_ShouldSucceed()
        {
            // Arrange
            SetupCurrentUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var issuance = new MaterialIssuance
            {
                MaterialIssuanceId = 500,
                Task = new ProjectTask { Phase = new Phase { Project = project } },
                Items = new List<MaterialIssuanceItem>
                {
                    new MaterialIssuanceItem { MaterialId = 50, Quantity = 10, ConversionRate = 1 }
                }
            };
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance> { issuance }.AsQueryable().BuildMock());

            // Previous returns: already returned 4
            var previousReturnedItems = new List<MaterialReturnItem>
            {
                new MaterialReturnItem
                {
                    MaterialId = 50,
                    Quantity = 4,
                    ConversionRate = 1,
                    Return = new MaterialReturn { OriginalIssuanceId = 500, IsDeleted = false }
                }
            };
            _mockReturnItemRepo.Setup(r => r.Query()).Returns(previousReturnedItems.AsQueryable().BuildMock());

            // Requesting to return 6 more (4 + 6 = 10 <= 10, which is exact match)
            var command = new CreateMaterialReturnCommand(500, "Reason", new List<ReturnItemDto>
            {
                new ReturnItemDto(50, 1, 6)
            });

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockInventoryService.Verify(s => s.UpdateStockAsync(5, 50, 6, It.IsAny<byte>(), It.IsAny<long>(), It.IsAny<string>(), 10, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
