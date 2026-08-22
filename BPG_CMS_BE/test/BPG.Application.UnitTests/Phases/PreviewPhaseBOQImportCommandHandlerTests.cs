using BPG.Application.DTOs.Phases;
using BPG.Application.Features.Phases.Commands;
using BPG.Application.Features.Phases.Handlers;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable.Moq;
using Moq;

namespace BPG.Application.UnitTests.Phases;

public class PreviewPhaseBOQImportCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepo = new();
    private readonly Mock<IGenericRepository<BOQItem>> _boqRepo = new();
    private readonly Mock<IGenericRepository<MaterialCatalog>> _materialRepo = new();
    private readonly Mock<IGenericRepository<BPG.Domain.Entities.Unit>> _unitRepo = new();
    private readonly Mock<IGenericRepository<MaterialConversion>> _conversionRepo = new();
    private readonly Mock<IGenericRepository<MaterialRequestItem>> _mrItemRepo = new();
    private readonly Mock<IGenericRepository<DirectPurchaseItem>> _dpItemRepo = new();
    private readonly Mock<IGenericRepository<MaterialIssuanceItem>> _issuanceItemRepo = new();
    private readonly Mock<IGenericRepository<MaterialRequest>> _mrRepo = new();
    private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _dpRepo = new();
    private readonly PreviewPhaseBOQImportCommandHandler _handler;

    public PreviewPhaseBOQImportCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<Phase>()).Returns(_phaseRepo.Object);
        _uow.Setup(x => x.Repository<BOQItem>()).Returns(_boqRepo.Object);
        _uow.Setup(x => x.Repository<MaterialCatalog>()).Returns(_materialRepo.Object);
        _uow.Setup(x => x.Repository<BPG.Domain.Entities.Unit>()).Returns(_unitRepo.Object);
        _uow.Setup(x => x.Repository<MaterialConversion>()).Returns(_conversionRepo.Object);
        _uow.Setup(x => x.Repository<MaterialRequestItem>()).Returns(_mrItemRepo.Object);
        _uow.Setup(x => x.Repository<DirectPurchaseItem>()).Returns(_dpItemRepo.Object);
        _uow.Setup(x => x.Repository<MaterialIssuanceItem>()).Returns(_issuanceItemRepo.Object);
        _uow.Setup(x => x.Repository<MaterialRequest>()).Returns(_mrRepo.Object);
        _uow.Setup(x => x.Repository<DirectPurchaseRequest>()).Returns(_dpRepo.Object);
        _handler = new PreviewPhaseBOQImportCommandHandler(_uow.Object);
        SetupBaseData();
    }

    [Fact]
    public async Task UTCID01_Handle_ShorterFileThanCurrentBOQ_ShouldReturnDeletionAndShorterReplacementList()
    {
        var kg = new BPG.Domain.Entities.Unit { UnitId = 1, UnitCode = "KG", UnitName = "Kilogram" };
        var material1 = new MaterialCatalog { MaterialId = 1, Code = "MAT-001", Name = "Cát", BaseUnitId = 1 };
        var material2 = new MaterialCatalog { MaterialId = 2, Code = "MAT-002", Name = "Xi măng", BaseUnitId = 1 };
        _boqRepo.Setup(x => x.Query()).Returns(new[]
        {
            new BOQItem
            {
                BOQItemId = 1, PhaseId = 1, MaterialId = 1, Material = material1,
                UnitId = 1, Unit = kg, Quantity = 10, ConversionRate = 1
            },
            new BOQItem
            {
                BOQItemId = 2, PhaseId = 1, MaterialId = 2, Material = material2,
                UnitId = 1, Unit = kg, Quantity = 25, ConversionRate = 1
            }
        }.AsQueryable().BuildMockDbSet().Object);

        var result = await _handler.Handle(Command(
            new PhaseBOQImportRowInput(2, "MAT-001", 10, "KG")), CancellationToken.None);

        result.CanApply.Should().BeTrue();
        result.UnchangedCount.Should().Be(1);
        result.DeletedCount.Should().Be(1);
        result.Rows.Should().Contain(x => x.MaterialCode == "MAT-002" && x.Status == BOQImportRowStatus.Deleted);
        result.MergedItems.Should().ContainSingle()
            .Which.Should().Match<PhaseBOQImportMergedItemDto>(x => x.MaterialCode == "MAT-001" && x.Quantity == 10);
    }

    [Fact]
    public async Task UTCID02_Handle_DuplicateMaterialCode_ShouldReturnRowErrors()
    {
        var result = await _handler.Handle(Command(
            new PhaseBOQImportRowInput(2, "MAT-001", 10, "KG"),
            new PhaseBOQImportRowInput(3, "MAT-002", 10, "KG"),
            new PhaseBOQImportRowInput(4, "mat-002", 20, "KG")), CancellationToken.None);

        result.CanApply.Should().BeFalse();
        result.ErrorCount.Should().Be(2);
        result.Rows.Where(x => x.MaterialCode == "MAT-002")
            .Should().OnlyContain(x => x.Status == BOQImportRowStatus.Error);
    }

    [Fact]
    public async Task UTCID03_Handle_DiscreteUnitWithFraction_ShouldReturnError()
    {
        var result = await _handler.Handle(Command(
            new PhaseBOQImportRowInput(2, "MAT-001", 10, "KG"),
            new PhaseBOQImportRowInput(3, "MAT-003", 1.5m, "PCS")), CancellationToken.None);

        result.CanApply.Should().BeFalse();
        result.Rows.Single(x => x.MaterialCode == "MAT-003").Errors.Should().Contain(x => x.Contains("số nguyên"));
    }

    [Fact]
    public async Task UTCID04_Handle_UnsupportedUnit_ShouldReturnError()
    {
        var result = await _handler.Handle(Command(
            new PhaseBOQImportRowInput(2, "MAT-001", 10, "KG"),
            new PhaseBOQImportRowInput(3, "MAT-002", 5, "PCS")), CancellationToken.None);

        result.CanApply.Should().BeFalse();
        result.Rows.Single(x => x.MaterialCode == "MAT-002").Errors.Should().Contain(x => x.Contains("không được hỗ trợ"));
    }

    [Fact]
    public async Task UTCID05_Handle_ChangedConversionRateForInUseItem_ShouldReturnError()
    {
        var kg = new BPG.Domain.Entities.Unit { UnitId = 1, UnitCode = "KG", UnitName = "Kilogram" };
        var ton = new BPG.Domain.Entities.Unit { UnitId = 3, UnitCode = "TON", UnitName = "Tấn" };
        _unitRepo.Setup(x => x.Query()).Returns(new[] { kg, ton }.AsQueryable().BuildMockDbSet().Object);
        _conversionRepo.Setup(x => x.Query()).Returns(new[]
        {
            new MaterialConversion { MaterialId = 1, AlternativeUnitId = 3, ConversionRate = 1000 }
        }.AsQueryable().BuildMockDbSet().Object);

        var material = new MaterialCatalog { MaterialId = 1, Code = "MAT-001", Name = "Cát", BaseUnitId = 1 };
        var existing = new BOQItem
        {
            BOQItemId = 1,
            PhaseId = 1,
            MaterialId = 1,
            Material = material,
            UnitId = 3,
            Unit = ton,
            Quantity = 10,
            ConversionRate = 500
        };
        _boqRepo.Setup(x => x.Query()).Returns(new[] { existing }.AsQueryable().BuildMockDbSet().Object);
        _mrItemRepo.Setup(x => x.Query()).Returns(new[]
        {
            new MaterialRequestItem
            {
                MaterialId = 1,
                Request = new MaterialRequest { PhaseId = 1 }
            }
        }.AsQueryable().BuildMockDbSet().Object);

        var result = await _handler.Handle(Command(
            new PhaseBOQImportRowInput(2, "MAT-001", 10, "TON")), CancellationToken.None);

        result.CanApply.Should().BeFalse();
        result.Rows.Single().Errors.Should().Contain(x => x.Contains("đã phát sinh nghiệp vụ"));
    }

    [Fact]
    public async Task UTCID06_Handle_FileMissingInUseMaterial_ShouldReturnDeletionError()
    {
        _mrItemRepo.Setup(x => x.Query()).Returns(new[]
        {
            new MaterialRequestItem
            {
                MaterialId = 1,
                Request = new MaterialRequest { PhaseId = 1 }
            }
        }.AsQueryable().BuildMockDbSet().Object);

        var result = await _handler.Handle(Command(
            new PhaseBOQImportRowInput(2, "MAT-002", 25, "KG")), CancellationToken.None);

        result.CanApply.Should().BeFalse();
        result.DeletedCount.Should().Be(0);
        result.Rows.Single(x => x.MaterialCode == "MAT-001").Errors
            .Should().Contain(x => x.Contains("Không thể xóa"));
    }

    private PreviewPhaseBOQImportCommand Command(params PhaseBOQImportRowInput[] rows) =>
        new(1, 1, rows.ToList());

    private void SetupBaseData()
    {
        var project = new Project { ProjectId = 1, Status = ProjectStatus.Draft };
        var phase = new Phase { PhaseId = 1, ProjectId = 1, Project = project, Status = PhaseStatus.Draft };
        _phaseRepo.Setup(x => x.Query()).Returns(new[] { phase }.AsQueryable().BuildMockDbSet().Object);

        var kg = new BPG.Domain.Entities.Unit { UnitId = 1, UnitCode = "KG", UnitName = "Kilogram" };
        var pcs = new BPG.Domain.Entities.Unit { UnitId = 2, UnitCode = "PCS", UnitName = "Cái", IsDiscrete = true };
        _unitRepo.Setup(x => x.Query()).Returns(new[] { kg, pcs }.AsQueryable().BuildMockDbSet().Object);

        var material1 = new MaterialCatalog { MaterialId = 1, Code = "MAT-001", Name = "Cát", BaseUnitId = 1 };
        var material2 = new MaterialCatalog { MaterialId = 2, Code = "MAT-002", Name = "Xi măng", BaseUnitId = 1 };
        var material3 = new MaterialCatalog { MaterialId = 3, Code = "MAT-003", Name = "Gạch", BaseUnitId = 2 };
        _materialRepo.Setup(x => x.Query()).Returns(new[] { material1, material2, material3 }.AsQueryable().BuildMockDbSet().Object);

        var existing = new BOQItem
        {
            BOQItemId = 1,
            PhaseId = 1,
            MaterialId = 1,
            Material = material1,
            UnitId = 1,
            Unit = kg,
            Quantity = 10,
            ConversionRate = 1
        };
        _boqRepo.Setup(x => x.Query()).Returns(new[] { existing }.AsQueryable().BuildMockDbSet().Object);
        _conversionRepo.Setup(x => x.Query()).Returns(Array.Empty<MaterialConversion>().AsQueryable().BuildMockDbSet().Object);
        _mrItemRepo.Setup(x => x.Query()).Returns(Array.Empty<MaterialRequestItem>().AsQueryable().BuildMockDbSet().Object);
        _dpItemRepo.Setup(x => x.Query()).Returns(Array.Empty<DirectPurchaseItem>().AsQueryable().BuildMockDbSet().Object);
        _issuanceItemRepo.Setup(x => x.Query()).Returns(Array.Empty<MaterialIssuanceItem>().AsQueryable().BuildMockDbSet().Object);
        _mrRepo.Setup(x => x.Query()).Returns(Array.Empty<MaterialRequest>().AsQueryable().BuildMockDbSet().Object);
        _dpRepo.Setup(x => x.Query()).Returns(Array.Empty<DirectPurchaseRequest>().AsQueryable().BuildMockDbSet().Object);
    }
}
