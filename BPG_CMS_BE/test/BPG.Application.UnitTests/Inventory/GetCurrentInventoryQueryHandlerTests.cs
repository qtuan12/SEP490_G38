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

using BPG.Application.IServices;

namespace BPG.Application.UnitTests.Inventory
{
    public class GetCurrentInventoryQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<SystemConfig>> _mockConfigRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<BOQItem>> _mockBoqRepo;
        private readonly Mock<IGenericRepository<MaterialIssuanceItem>> _mockIssuanceItemRepo;
        private readonly Mock<IGenericRepository<PurchaseOrderItem>> _mockPoItemRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IProjectAccessService> _mockProjectAccessService;
        private readonly GetCurrentInventoryQueryHandler _handler;

        public GetCurrentInventoryQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockConfigRepo = new Mock<IGenericRepository<SystemConfig>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockBoqRepo = new Mock<IGenericRepository<BOQItem>>();
            _mockIssuanceItemRepo = new Mock<IGenericRepository<MaterialIssuanceItem>>();
            _mockPoItemRepo = new Mock<IGenericRepository<PurchaseOrderItem>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockProjectAccessService = new Mock<IProjectAccessService>();

            _mockProjectAccessService
                .Setup(p => p.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new HashSet<long> { 1, 2, 3, 4, 5, 10, 100 });

            _mockUow.Setup(u => u.Repository<SystemConfig>()).Returns(_mockConfigRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBoqRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuanceItem>()).Returns(_mockIssuanceItemRepo.Object);
            _mockUow.Setup(u => u.Repository<PurchaseOrderItem>()).Returns(_mockPoItemRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);

            // Defaults
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig>().AsQueryable().BuildMock());
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase>().AsQueryable().BuildMock());
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem>().AsQueryable().BuildMock());
            _mockPoItemRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrderItem>().AsQueryable().BuildMock());
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory>().AsQueryable().BuildMock());

            _handler = new GetCurrentInventoryQueryHandler(_mockUow.Object, _mockProjectAccessService.Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldCalculateSafetyThresholdCorrectly()
        {
            // Arrange
            long projectId = 5;
            var config = new SystemConfig { ConfigKey = "NguongTonKhoThap", ConfigValue = "15" };
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig> { config }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement", Specification = "Grade 50" };
            var unit = new Unit { UnitId = 2, UnitName = "Bag" };
            var inventory = new CurrentInventory
            {
                InventoryId = 300,
                ProjectId = projectId,
                MaterialId = 50,
                Quantity = 60,
                ReservedQuantity = 10,
                LastUpdated = DateTime.UtcNow,
                Material = material,
                Unit = unit,
                UnitId = 2
            };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().HaveCount(1);
            result.Data!.First().SafetyThreshold.Should().Be(15);
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldRetrieveSupplierNameCorrectly()
        {
            // Arrange
            long projectId = 5;
            var phase = new Phase { PhaseId = 20, ProjectId = projectId, Name = "Foundation Phase", IsDeleted = false };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var po1 = new PurchaseOrder
            {
                POId = 1,
                SupplierId = 10,
                Supplier = new Supplier { SupplierId = 10, SupplierName = "Supplier Alpha" },
                Request = new MaterialRequest { Phase = phase },
                OrderDate = DateTime.UtcNow.AddDays(-2)
            };
            var po2 = new PurchaseOrder
            {
                POId = 2,
                SupplierId = 10,
                Supplier = new Supplier { SupplierId = 10, SupplierName = "Supplier Alpha" },
                Request = new MaterialRequest { Phase = phase },
                OrderDate = DateTime.UtcNow.AddDays(-1)
            };
            var poItem1 = new PurchaseOrderItem { POId = 1, MaterialId = 50, Quantity = 10, UnitPrice = 100, PurchaseOrder = po1 };
            var poItem2 = new PurchaseOrderItem { POId = 2, MaterialId = 50, Quantity = 20, UnitPrice = 130, PurchaseOrder = po2 };
            _mockPoItemRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrderItem> { poItem1, poItem2 }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement", Specification = "Grade 50" };
            var unit = new Unit { UnitId = 2, UnitName = "Bag" };
            var inventory = new CurrentInventory
            {
                InventoryId = 300,
                ProjectId = projectId,
                MaterialId = 50,
                Quantity = 60,
                ReservedQuantity = 10,
                LastUpdated = DateTime.UtcNow,
                Material = material,
                Unit = unit,
                UnitId = 2
            };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            var dto = result.Data!.First();
            dto.SupplierName.Should().Be("Supplier Alpha");
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldCalculateBoqAndUsedQuantitiesCorrectly()
        {
            // Arrange
            long projectId = 5;
            var phase = new Phase { PhaseId = 20, ProjectId = projectId, Name = "Foundation Phase", IsDeleted = false };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var boqItem = new BOQItem { PhaseId = 20, MaterialId = 50, Quantity = 100, ConversionRate = 1, IsDeleted = false, Phase = phase };
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            var issuanceItem = new MaterialIssuanceItem
            {
                MaterialId = 50,
                Quantity = 40,
                ConversionRate = 1,
                Issuance = new MaterialIssuance
                {
                    IsDeleted = false,
                    Task = new ProjectTask { PhaseId = 20, Phase = phase }
                }
            };
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem> { issuanceItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement", Specification = "Grade 50" };
            var unit = new Unit { UnitId = 2, UnitName = "Bag" };
            var inventory = new CurrentInventory
            {
                InventoryId = 300,
                ProjectId = projectId,
                MaterialId = 50,
                Quantity = 60,
                ReservedQuantity = 10,
                LastUpdated = DateTime.UtcNow,
                Material = material,
                Unit = unit,
                UnitId = 2
            };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            var dto = result.Data!.First();
            dto.BoqQuantity.Should().Be(100);
            dto.UsedQuantity.Should().Be(40);
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldIncludePhaseUsagesCorrectly()
        {
            // Arrange
            long projectId = 5;
            var phase = new Phase { PhaseId = 20, ProjectId = projectId, Name = "Foundation Phase", IsDeleted = false };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var boqItem = new BOQItem { PhaseId = 20, MaterialId = 50, Quantity = 100, ConversionRate = 1, IsDeleted = false, Phase = phase };
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            var issuanceItem = new MaterialIssuanceItem
            {
                MaterialId = 50,
                Quantity = 40,
                ConversionRate = 1,
                Issuance = new MaterialIssuance
                {
                    IsDeleted = false,
                    Task = new ProjectTask { PhaseId = 20, Phase = phase }
                }
            };
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem> { issuanceItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement", Specification = "Grade 50" };
            var unit = new Unit { UnitId = 2, UnitName = "Bag" };
            var inventory = new CurrentInventory
            {
                InventoryId = 300,
                ProjectId = projectId,
                MaterialId = 50,
                Quantity = 60,
                ReservedQuantity = 10,
                LastUpdated = DateTime.UtcNow,
                Material = material,
                Unit = unit,
                UnitId = 2
            };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            var dto = result.Data!.First();
            dto.PhaseUsages.Should().HaveCount(1);
            dto.PhaseUsages.First().PhaseName.Should().Be("Foundation Phase");
            dto.PhaseUsages.First().BoqQuantity.Should().Be(100);
            dto.PhaseUsages.First().UsedQuantity.Should().Be(40);
        }

        [Fact]
        public async Task UTCID02_Handle_NoInventoryForProject_ShouldReturnEmptyList()
        {
            // Arrange
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory>().AsQueryable().BuildMock());
            var query = new GetCurrentInventoryQuery(5);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.Should().BeEmpty();
        }

        [Fact]
        public async Task UTCID03_Handle_SystemConfigKeyMissing_ShouldFallbackToDefaultThreshold()
        {
            // Arrange
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig>().AsQueryable().BuildMock()); // No threshold config

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement" };
            var unit = new Unit { UnitName = "Bag" };
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Material = material, Unit = unit };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(5);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Data!.First().SafetyThreshold.Should().Be(10m); // Fallback threshold
        }



        [Fact]
        public async Task UTCID05_Handle_ConversionRateNotOne_ShouldDivideQuantityByConversionRate()
        {
            // Arrange
            long projectId = 5;
            var phase = new Phase { PhaseId = 20, ProjectId = projectId, IsDeleted = false };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            // BOQ Item with ConversionRate = 2, Qty = 100 -> BaseQty = 100 / 2 = 50
            var boqItem = new BOQItem { PhaseId = 20, MaterialId = 50, Quantity = 100, ConversionRate = 2, IsDeleted = false, Phase = phase };
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            // Material Issuance Item with ConversionRate = 2.5, Qty = 50 -> BaseQty = 50 / 2.5 = 20
            var issuanceItem = new MaterialIssuanceItem
            {
                MaterialId = 50,
                Quantity = 50,
                ConversionRate = 2.5m,
                Issuance = new MaterialIssuance
                {
                    IsDeleted = false,
                    Task = new ProjectTask { PhaseId = 20, Phase = phase }
                }
            };
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem> { issuanceItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement" };
            var unit = new Unit { UnitName = "Bag" };
            var inventory = new CurrentInventory { ProjectId = projectId, MaterialId = 50, Material = material, Unit = unit };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            var dto = result.Data!.First();
            dto.BoqQuantity.Should().Be(50);
            dto.UsedQuantity.Should().Be(20);
            dto.PhaseUsages.First().BoqQuantity.Should().Be(50);
            dto.PhaseUsages.First().UsedQuantity.Should().Be(20);
        }

        [Fact]
        public async Task UTCID06_Handle_MultipleSuppliers_ShouldGetSupplierFromNewestPO()
        {
            // Arrange
            long projectId = 5;
            var phase = new Phase { PhaseId = 20, ProjectId = projectId, IsDeleted = false };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            // PO 1 (Supplier Alpha, ordered 2 days ago)
            var po1 = new PurchaseOrder
            {
                POId = 1,
                SupplierId = 10,
                Supplier = new Supplier { SupplierName = "Supplier Alpha" },
                Request = new MaterialRequest { Phase = phase },
                OrderDate = DateTime.UtcNow.AddDays(-2)
            };
            // PO 2 (Supplier Beta, ordered 1 day ago - newest!)
            var po2 = new PurchaseOrder
            {
                POId = 2,
                SupplierId = 20,
                Supplier = new Supplier { SupplierName = "Supplier Beta" },
                Request = new MaterialRequest { Phase = phase },
                OrderDate = DateTime.UtcNow.AddDays(-1)
            };

            var poItem1 = new PurchaseOrderItem { POId = 1, MaterialId = 50, Quantity = 10, UnitPrice = 100, PurchaseOrder = po1 };
            var poItem2 = new PurchaseOrderItem { POId = 2, MaterialId = 50, Quantity = 10, UnitPrice = 100, PurchaseOrder = po2 };
            _mockPoItemRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrderItem> { poItem1, poItem2 }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement" };
            var unit = new Unit { UnitName = "Bag" };
            var inventory = new CurrentInventory { ProjectId = projectId, MaterialId = 50, Material = material, Unit = unit };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data!.First().SupplierName.Should().Be("Supplier Beta"); // Picks Beta as it is the newest ordered PO
        }

        [Fact]
        public async Task UTCID07_Handle_MultiplePhasesAndMultipleMaterials_ShouldGroupAndCalculateCorrectly()
        {
            // Arrange
            long projectId = 5;
            var phase1 = new Phase { PhaseId = 10, ProjectId = projectId, Name = "Phase 1", IsDeleted = false };
            var phase2 = new Phase { PhaseId = 20, ProjectId = projectId, Name = "Phase 2", IsDeleted = false };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase1, phase2 }.AsQueryable().BuildMock());

            // BOQ: Material 50 in Phase 1 (Qty 100) and Phase 2 (Qty 150)
            var boq1 = new BOQItem { PhaseId = 10, MaterialId = 50, Quantity = 100, ConversionRate = 1, IsDeleted = false, Phase = phase1 };
            var boq2 = new BOQItem { PhaseId = 20, MaterialId = 50, Quantity = 150, ConversionRate = 1, IsDeleted = false, Phase = phase2 };
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq1, boq2 }.AsQueryable().BuildMock());

            // Used: Material 50 in Phase 1 (Qty 30) and Phase 2 (Qty 70)
            var issuance1 = new MaterialIssuanceItem
            {
                MaterialId = 50,
                Quantity = 30,
                ConversionRate = 1,
                Issuance = new MaterialIssuance { IsDeleted = false, Task = new ProjectTask { PhaseId = 10, Phase = phase1 } }
            };
            var issuance2 = new MaterialIssuanceItem
            {
                MaterialId = 50,
                Quantity = 70,
                ConversionRate = 1,
                Issuance = new MaterialIssuance { IsDeleted = false, Task = new ProjectTask { PhaseId = 20, Phase = phase2 } }
            };
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem> { issuance1, issuance2 }.AsQueryable().BuildMock());

            var material1 = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement" };
            var material2 = new MaterialCatalog { MaterialId = 60, Code = "MAT-60", Name = "Brick" };
            var unit = new Unit { UnitName = "Unit" };

            // Inventory has 2 materials
            var inventory1 = new CurrentInventory { ProjectId = projectId, MaterialId = 50, Material = material1, Unit = unit };
            var inventory2 = new CurrentInventory { ProjectId = projectId, MaterialId = 60, Material = material2, Unit = unit };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory1, inventory2 }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.Should().HaveCount(2);

            var cementDto = result.Data!.First(d => d.MaterialId == 50);
            cementDto.BoqQuantity.Should().Be(250); // 100 + 150
            cementDto.UsedQuantity.Should().Be(100); // 30 + 70
            cementDto.PhaseUsages.Should().HaveCount(2);
            cementDto.PhaseUsages.First(u => u.PhaseId == 10).BoqQuantity.Should().Be(100);
            cementDto.PhaseUsages.First(u => u.PhaseId == 20).BoqQuantity.Should().Be(150);

            var brickDto = result.Data!.First(d => d.MaterialId == 60);
            brickDto.BoqQuantity.Should().Be(0);
            brickDto.UsedQuantity.Should().Be(0);
        }

        [Fact]
        public async Task UTCID08_Handle_SoftDeletedBoqOrIssuance_ShouldIgnoreThem()
        {
            // Arrange
            long projectId = 5;
            var phase = new Phase { PhaseId = 20, ProjectId = projectId, IsDeleted = false };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            // BOQ Item is soft-deleted
            var boqItem = new BOQItem { PhaseId = 20, MaterialId = 50, Quantity = 100, ConversionRate = 1, IsDeleted = true, Phase = phase };
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            // Material Issuance is soft-deleted
            var issuanceItem = new MaterialIssuanceItem
            {
                MaterialId = 50,
                Quantity = 40,
                ConversionRate = 1,
                Issuance = new MaterialIssuance
                {
                    IsDeleted = true, // soft deleted!
                    Task = new ProjectTask { PhaseId = 20, Phase = phase }
                }
            };
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem> { issuanceItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = 50, Code = "MAT-50", Name = "Cement" };
            var unit = new Unit { UnitName = "Bag" };
            var inventory = new CurrentInventory { ProjectId = projectId, MaterialId = 50, Material = material, Unit = unit };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var query = new GetCurrentInventoryQuery(projectId);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            var dto = result.Data!.First();
            dto.BoqQuantity.Should().Be(0); // Ignored soft-deleted boq
            dto.UsedQuantity.Should().Be(0); // Ignored soft-deleted issuance
        }
    }
}


