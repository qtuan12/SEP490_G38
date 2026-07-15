using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialIssuances.Commands;
using BPG.Application.Features.MaterialIssuances.Handlers;
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
using BPG.Application.UnitTests.Helpers;

namespace BPG.Application.UnitTests.MaterialIssuances
{
    public class CreateMaterialIssuanceCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<MaterialIssuanceItem>> _mockIssuanceItemRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly CreateMaterialIssuanceCommandHandler _handler;

        public CreateMaterialIssuanceCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockIssuanceItemRepo = new Mock<IGenericRepository<MaterialIssuanceItem>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockInventoryService = new Mock<IInventoryService>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuanceItem>()).Returns(_mockIssuanceItemRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);

            // Default Query Mock setups
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuance>().AsQueryable().BuildMock());
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem>().AsQueryable().BuildMock());
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory>().AsQueryable().BuildMock());

            // Default AddAsync setups
            _mockIssuanceRepo.Setup(r => r.AddAsync(It.IsAny<MaterialIssuance>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialIssuance, CancellationToken>((mi, ct) => mi.MaterialIssuanceId = 600)
                .Returns(Task.CompletedTask);

            _handler = new CreateMaterialIssuanceCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockInventoryService.Object
            );
        }



        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldCreateMaterialIssuanceSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                IsLocked = false,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // Project inventory with sufficient stock (Qty = 100, Reserved = 10 -> Available = 90 >= required = 20)
            var material = new MaterialCatalog { MaterialId = 50, Name = "Cement", BaseUnit = new Unit { UnitName = "Bag" } };
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 100, ReservedQuantity = 10, Material = material };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var items = new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(MaterialId: 50, UnitId: 1, Quantity: 20, ConversionRate: 1)
            };
            var command = new CreateMaterialIssuanceCommand(TaskId: 100, Purpose: "Slab pouring", Items: items);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().Be(600); // Set by callback

            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockIssuanceRepo.Verify(r => r.AddAsync(It.Is<MaterialIssuance>(m => m.TaskId == 100 && m.Purpose == "Slab pouring"), It.IsAny<CancellationToken>()), Times.Once);
            _mockInventoryService.Verify(s => s.UpdateStockAsync(5, 50, -20, InventoryTransactionType.Issuance, 600, EntityType.MaterialIssuance, 10, It.IsAny<CancellationToken>()), Times.Once);
            _mockIssuanceItemRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<MaterialIssuanceItem>>(l => l.First().MaterialId == 50), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_EmptyItemsList_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Danh sách vật tư xuất dùng không được để trống.");
        }

        [Fact]
        public async Task UTCID03_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var command = new CreateMaterialIssuanceCommand(999, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 10)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("ProjectTask với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotFound_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = null } // No project!
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 10)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy dự án liên kết với công việc này.");
        }

        [Fact]
        public async Task UTCID05_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.Completed }; // Inactive
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 10)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án liên kết phải ở trạng thái đang tiến hành (InProgress).");
        }

        [Fact]
        public async Task UTCID06_Handle_TaskIsLocked_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                IsLocked = true, // Locked!
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 10)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Công việc này đã bị khóa (đã nghiệm thu hoặc hoàn thành). Không thể xuất thêm vật tư.");
        }

        [Fact]
        public async Task UTCID07_Handle_NoInventoryEntry_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                IsLocked = false,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // Empty project inventory
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory>().AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(99, 1, 10) // Material 99 not in inventory
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Vật tư ID 99 không tồn tại trong kho của dự án.");
        }

        [Fact]
        public async Task UTCID08_Handle_InsufficientStock_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                IsLocked = false,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // Available stock is only 5 (15 - 10 = 5 < 10)
            var material = new MaterialCatalog { MaterialId = 50, Name = "Cement", BaseUnit = new Unit { UnitName = "Bag" } };
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 15, ReservedQuantity = 10, Material = material };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 10)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không đủ tồn kho khả dụng cho vật tư [Cement]. Yêu cầu xuất: 10 Bag, tồn khả dụng còn lại: 5 Bag.");
        }

        [Fact]
        public async Task UTCID09_Handle_ConversionRateApplied_ShouldSubtractCorrectBaseQty()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                IsLocked = false,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // Conversion rate of 0.5: quantity of 10 / 0.5 = 20 base units.
            // Stock available = 30 bag (Cement)
            var material = new MaterialCatalog { MaterialId = 50, Name = "Cement", BaseUnit = new Unit { UnitName = "Bag" } };
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 30, ReservedQuantity = 0, Material = material };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var items = new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(MaterialId: 50, UnitId: 1, Quantity: 10, ConversionRate: 0.5m)
            };
            var command = new CreateMaterialIssuanceCommand(TaskId: 100, Purpose: "Slab pouring", Items: items);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            // Required base quantity must be 10 / 0.5 = 20, which is updated as -20 in stock.
            _mockInventoryService.Verify(s => s.UpdateStockAsync(5, 50, -20, InventoryTransactionType.Issuance, 600, EntityType.MaterialIssuance, 10, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID11_Handle_ExactlyAvailableQuantity_ShouldCreateSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask { TaskId = 100, IsLocked = false, Phase = new Phase { Project = project } };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Name = "Cement", BaseUnit = new Unit { UnitName = "Bag" } };
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 10, ReservedQuantity = 0, Material = material };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 10, 1) // 10 / 1 = 10 (exactly equal to available)
            });

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockInventoryService.Verify(s => s.UpdateStockAsync(5, 50, -10, InventoryTransactionType.Issuance, It.IsAny<long>(), EntityType.MaterialIssuance, 10, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID12_Handle_MultipleItemsOneInsufficient_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask { TaskId = 100, IsLocked = false, Phase = new Phase { Project = project } };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var m1 = new MaterialCatalog { MaterialId = 50, Name = "Cement", BaseUnit = new Unit { UnitName = "Bag" } };
            var m2 = new MaterialCatalog { MaterialId = 51, Name = "Sand", BaseUnit = new Unit { UnitName = "Bag" } };
            var i1 = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 10, ReservedQuantity = 0, Material = m1 };
            var i2 = new CurrentInventory { ProjectId = 5, MaterialId = 51, Quantity = 5, ReservedQuantity = 0, Material = m2 };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { i1, i2 }.AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 5, 1),
                new CreateMaterialIssuanceItemDto(51, 1, 10, 1) // Sand requires 10 but only has 5
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không đủ tồn kho khả dụng cho vật tư [Sand]. Yêu cầu xuất: 10 Bag, tồn khả dụng còn lại: 5 Bag.");
        }

        [Fact]
        public async Task UTCID13_Handle_PurposeNullOrEmpty_ShouldCreateSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask { TaskId = 100, IsLocked = false, Phase = new Phase { Project = project } };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Name = "Cement", BaseUnit = new Unit { UnitName = "Bag" } };
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 10, ReservedQuantity = 0, Material = material };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var command = new CreateMaterialIssuanceCommand(100, null, new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 5, 1)
            });

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID14_Handle_ExceptionDuringStockUpdate_ShouldRollbackAndThrow()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask { TaskId = 100, IsLocked = false, Phase = new Phase { Project = project } };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Name = "Cement", BaseUnit = new Unit { UnitName = "Bag" } };
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 10, ReservedQuantity = 0, Material = material };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            _mockInventoryService.Setup(s => s.UpdateStockAsync(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<decimal>(), It.IsAny<byte>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("DB Error"));

            var command = new CreateMaterialIssuanceCommand(100, "Purpose", new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(50, 1, 5, 1)
            });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<Exception>().WithMessage("DB Error");
            _mockUow.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID15_Handle_DiscreteUnitWithDecimalQuantity_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                IsLocked = false,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var material = new MaterialCatalog 
            { 
                MaterialId = 50, 
                Name = "Cái bay", 
                BaseUnit = new Unit { UnitName = "Cái", IsDiscrete = true } 
            };
            var inventory = new CurrentInventory 
            { 
                ProjectId = 5, 
                MaterialId = 50, 
                Quantity = 100, 
                ReservedQuantity = 10, 
                Material = material 
            };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var items = new List<CreateMaterialIssuanceItemDto>
            {
                new CreateMaterialIssuanceItemDto(MaterialId: 50, UnitId: 1, Quantity: 20.5m, ConversionRate: 1)
            };
            var command = new CreateMaterialIssuanceCommand(TaskId: 100, Purpose: "Slab pouring", Items: items);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
            exception.Which.Message.Should().Contain("yêu cầu số lượng xuất phải là số nguyên");
        }
    }
}
