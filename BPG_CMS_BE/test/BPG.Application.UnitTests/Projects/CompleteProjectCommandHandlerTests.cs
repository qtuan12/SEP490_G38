namespace BPG.Application.UnitTests.Projects;

using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

public class CompleteProjectCommandHandlerTests
{
    private const long ProjectId = 100;

    private readonly Mock<IUnitOfWork> _mockUow;
    private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
    private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
    private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
    private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
    private readonly Mock<IGenericRepository<MaterialRequest>> _mockMaterialRequestRepo;
    private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPurchaseOrderRepo;
    private readonly Mock<IGenericRepository<GoodsReceipt>> _mockGoodsReceiptRepo;
    private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
    private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDirectPurchaseRepo;
    private readonly Mock<IGenericRepository<SurplusRequest>> _mockSurplusRequestRepo;
    private readonly Mock<IGenericRepository<SurplusTransfer>> _mockSurplusTransferRepo;
    private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
    private readonly Mock<IGenericRepository<User>> _mockUserRepo;
    private readonly Mock<ICurrentUserService> _mockCurrentUserService;
    private readonly CompleteProjectCommandHandler _handler;

    public CompleteProjectCommandHandlerTests()
    {
        _mockUow = new Mock<IUnitOfWork>();
        _mockProjectRepo = new Mock<IGenericRepository<Project>>();
        _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
        _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
        _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
        _mockMaterialRequestRepo = new Mock<IGenericRepository<MaterialRequest>>();
        _mockPurchaseOrderRepo = new Mock<IGenericRepository<PurchaseOrder>>();
        _mockGoodsReceiptRepo = new Mock<IGenericRepository<GoodsReceipt>>();
        _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();
        _mockDirectPurchaseRepo = new Mock<IGenericRepository<DirectPurchaseRequest>>();
        _mockSurplusRequestRepo = new Mock<IGenericRepository<SurplusRequest>>();
        _mockSurplusTransferRepo = new Mock<IGenericRepository<SurplusTransfer>>();
        _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
        _mockUserRepo = new Mock<IGenericRepository<User>>();
        _mockCurrentUserService = new Mock<ICurrentUserService>();

        _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
        _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
        _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
        _mockUow.Setup(u => u.Repository<Incident>()).Returns(_mockIncidentRepo.Object);
        _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMaterialRequestRepo.Object);
        _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPurchaseOrderRepo.Object);
        _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockGoodsReceiptRepo.Object);
        _mockUow.Setup(u => u.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);
        _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDirectPurchaseRepo.Object);
        _mockUow.Setup(u => u.Repository<SurplusRequest>()).Returns(_mockSurplusRequestRepo.Object);
        _mockUow.Setup(u => u.Repository<SurplusTransfer>()).Returns(_mockSurplusTransferRepo.Object);
        _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
        _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
        _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _mockProjectRepo.SetupMockData(new List<Project>());
        _mockPhaseRepo.SetupMockData(new List<Phase>());
        _mockTaskRepo.SetupMockData(new List<ProjectTask>());
        _mockIncidentRepo.SetupMockData(new List<Incident>());
        _mockMaterialRequestRepo.SetupMockData(new List<MaterialRequest>());
        _mockPurchaseOrderRepo.SetupMockData(new List<PurchaseOrder>());
        _mockGoodsReceiptRepo.SetupMockData(new List<GoodsReceipt>());
        _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>());
        _mockDirectPurchaseRepo.SetupMockData(new List<DirectPurchaseRequest>());
        _mockSurplusRequestRepo.SetupMockData(new List<SurplusRequest>());
        _mockSurplusTransferRepo.SetupMockData(new List<SurplusTransfer>());
        _mockMemberRepo.SetupMockData(new List<ProjectMember>());
        _mockUserRepo.SetupMockData(new List<User>());

        _mockCurrentUserService.Setup(s => s.UserId).Returns(1L);

        _handler = new CompleteProjectCommandHandler(
            _mockUow.Object,
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender(),
            _mockCurrentUserService.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ProjectNotFound_ShouldThrowNotFoundException()
    {
        _mockProjectRepo.SetupMockData(new List<Project>());

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID02_Handle_ProjectNotActive_ShouldThrowExpectedErrorCode()
    {
        var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Paused };
        _mockProjectRepo.SetupMockData(new List<Project> { project });

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_INPROGRESS");
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectHasUnfinishedTasks_ShouldThrowExpectedErrorCode()
    {
        var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
        var phase = new Phase { PhaseId = 1, ProjectId = ProjectId };
        var task = new ProjectTask { TaskId = 1, Phase = phase, ProgressPercent = 80, Status = BPG.Domain.Constants.TaskStatus.InProgress };

        _mockProjectRepo.SetupMockData(new List<Project> { project });
        _mockPhaseRepo.SetupMockData(new List<Phase> { phase });
        _mockTaskRepo.SetupMockData(new List<ProjectTask> { task });

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.ErrorCode.Should().Be("ERR_PROJECT_TASKS_NOT_COMPLETED");
    }

    [Fact]
    public async Task UTCID04_Handle_ProjectHasPendingIncidents_ShouldThrowExpectedErrorCode()
    {
        SetupCompletableProject();
        var incident = new Incident { IncidentId = 1, ProjectId = ProjectId, Status = "WaitingReview" };

        _mockIncidentRepo.SetupMockData(new List<Incident> { incident });

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingIncidents);
    }

    [Fact]
    public async Task UTCID05_Handle_ValidInProgressProject_ShouldCompleteWithoutError()
    {
        var phase = SetupCompletableProject();
        var project = phase.Project;
        var po = new PurchaseOrder
        {
            POId = 1,
            ProjectId = ProjectId,
            Project = project,
            Status = PurchaseOrderStatus.FullyReceived
        };
        var user = new User { UserId = 1, FullName = "Nguyễn Văn A" };
        var member = new ProjectMember { ProjectId = ProjectId, UserId = 2 };

        _mockIncidentRepo.SetupMockData(new List<Incident>
        {
            new() { IncidentId = 1, ProjectId = ProjectId, Status = IncidentStatus.Approved }
        });
        _mockMaterialRequestRepo.SetupMockData(new List<MaterialRequest>
        {
            new() { RequestId = 1, PhaseId = phase.PhaseId, Phase = phase, Status = MaterialRequestStatus.Approved }
        });
        _mockPurchaseOrderRepo.SetupMockData(new List<PurchaseOrder> { po });
        _mockGoodsReceiptRepo.SetupMockData(new List<GoodsReceipt>
        {
            new() { ReceiptId = 1, POId = po.POId, PurchaseOrder = po, Status = GoodsReceiptStatus.Approved }
        });
        _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>
        {
            new() { AdjustmentId = 1, ProjectId = ProjectId, Status = InventoryAdjustmentStatus.Approved }
        });
        _mockDirectPurchaseRepo.SetupMockData(new List<DirectPurchaseRequest>
        {
            new() { DirectPurchaseId = 1, ProjectId = ProjectId, Status = DirectPurchaseStatus.Approved }
        });
        _mockSurplusRequestRepo.SetupMockData(new List<SurplusRequest>
        {
            new() { SurplusRequestId = 1, ProjectId = ProjectId, Status = SurplusRequestStatus.Processed }
        });
        _mockSurplusTransferRepo.SetupMockData(new List<SurplusTransfer>
        {
            new() { SurplusTransferId = 1, FromProjectId = ProjectId, ToProjectId = ProjectId + 1, Status = SurplusTransferStatus.Received }
        });
        _mockUserRepo.SetupMockData(new List<User> { user });
        _mockMemberRepo.SetupMockData(new List<ProjectMember> { member });

        var command = new CompleteProjectCommand(ProjectId);
        Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UTCID06_Handle_ProjectHasNoPhase_ShouldThrowExpectedErrorCode()
    {
        _mockProjectRepo.SetupMockData(new List<Project>
        {
            new() { ProjectId = ProjectId, Status = ProjectStatus.InProgress }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasNoPhases);
    }

    [Fact]
    public async Task UTCID07_Handle_ProjectHasUnacceptedPhase_ShouldThrowExpectedErrorCode()
    {
        SetupCompletableProject(PhaseStatus.Completed);

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectPhasesNotAccepted);
    }

    [Fact]
    public async Task UTCID08_Handle_ApprovedPhaseHasHundredPercentTaskWithStaleStatus_ShouldCompleteWithoutError()
    {
        var phase = SetupCompletableProject();
        _mockTaskRepo.SetupMockData(new List<ProjectTask>
        {
            new()
            {
                TaskId = 1,
                PhaseId = phase.PhaseId,
                Phase = phase,
                ProgressPercent = 100,
                Status = BPG.Domain.Constants.TaskStatus.InProgress
            }
        });

        await CompleteAct().Should().NotThrowAsync();
    }

    [Fact]
    public async Task UTCID09_Handle_ProjectHasPendingMaterialRequest_ShouldThrowExpectedErrorCode()
    {
        var phase = SetupCompletableProject();
        _mockMaterialRequestRepo.SetupMockData(new List<MaterialRequest>
        {
            new() { RequestId = 1, PhaseId = phase.PhaseId, Phase = phase, Status = MaterialRequestStatus.Pending }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingMaterialRequests);
    }

    [Fact]
    public async Task UTCID10_Handle_ProjectHasPendingPurchaseOrder_ShouldThrowExpectedErrorCode()
    {
        SetupCompletableProject();
        _mockPurchaseOrderRepo.SetupMockData(new List<PurchaseOrder>
        {
            new() { POId = 1, ProjectId = ProjectId, Status = PurchaseOrderStatus.PartiallyReceived }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingPurchaseOrders);
    }

    [Fact]
    public async Task UTCID11_Handle_ProjectHasPendingGoodsReceipt_ShouldThrowExpectedErrorCode()
    {
        var project = SetupCompletableProject().Project;
        var po = new PurchaseOrder { POId = 1, ProjectId = ProjectId, Project = project, Status = PurchaseOrderStatus.FullyReceived };
        _mockPurchaseOrderRepo.SetupMockData(new List<PurchaseOrder> { po });
        _mockGoodsReceiptRepo.SetupMockData(new List<GoodsReceipt>
        {
            new() { ReceiptId = 1, POId = po.POId, PurchaseOrder = po, Status = GoodsReceiptStatus.Draft }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingGoodsReceipts);
    }

    [Fact]
    public async Task UTCID12_Handle_ProjectHasPendingInventoryAdjustment_ShouldThrowExpectedErrorCode()
    {
        SetupCompletableProject();
        _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>
        {
            new() { AdjustmentId = 1, ProjectId = ProjectId, Status = InventoryAdjustmentStatus.RevisionRequired }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingInventoryAdjustments);
    }

    [Fact]
    public async Task UTCID13_Handle_ProjectHasPendingDirectPurchase_ShouldThrowExpectedErrorCode()
    {
        SetupCompletableProject();
        _mockDirectPurchaseRepo.SetupMockData(new List<DirectPurchaseRequest>
        {
            new() { DirectPurchaseId = 1, ProjectId = ProjectId, Status = DirectPurchaseStatus.WaitingApproval }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingDirectPurchases);
    }

    [Fact]
    public async Task UTCID14_Handle_ProjectHasPendingSurplusRequest_ShouldThrowExpectedErrorCode()
    {
        SetupCompletableProject();
        _mockSurplusRequestRepo.SetupMockData(new List<SurplusRequest>
        {
            new() { SurplusRequestId = 1, ProjectId = ProjectId, Status = SurplusRequestStatus.Processing }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingSurplus);
    }

    [Fact]
    public async Task UTCID15_Handle_ProjectHasPendingIncomingSurplusTransfer_ShouldThrowExpectedErrorCode()
    {
        SetupCompletableProject();
        _mockSurplusTransferRepo.SetupMockData(new List<SurplusTransfer>
        {
            new() { SurplusTransferId = 1, FromProjectId = ProjectId + 1, ToProjectId = ProjectId, Status = SurplusTransferStatus.Dispatched }
        });

        var ex = await CompleteAct().Should().ThrowAsync<BusinessException>();

        ex.Which.ErrorCode.Should().Be(ErrorCodes.ProjectHasPendingSurplus);
    }

    [Fact]
    public async Task UTCID16_Handle_ReplacedPhaseHasOnlyObsoleteTasks_ShouldCompleteWithoutError()
    {
        var replacementPhase = SetupCompletableProject();
        var project = replacementPhase.Project;
        var retiredPhase = new Phase
        {
            PhaseId = 2,
            ProjectId = ProjectId,
            Project = project,
            Status = PhaseStatus.InProgress
        };
        retiredPhase.Tasks.Add(new ProjectTask
        {
            TaskId = 10,
            PhaseId = retiredPhase.PhaseId,
            Phase = retiredPhase,
            Status = BPG.Domain.Constants.TaskStatus.Obsolete,
            ProgressPercent = 40
        });
        replacementPhase.Tasks.Add(new ProjectTask
        {
            TaskId = 11,
            PhaseId = replacementPhase.PhaseId,
            Phase = replacementPhase,
            // Phase acceptance currently accepts a 100% task even if this technical
            // status has not been normalized to Completed yet.
            Status = BPG.Domain.Constants.TaskStatus.InProgress,
            ProgressPercent = 100
        });

        _mockPhaseRepo.SetupMockData(new List<Phase> { retiredPhase, replacementPhase });
        _mockTaskRepo.SetupMockData(retiredPhase.Tasks.Concat(replacementPhase.Tasks).ToList());

        await CompleteAct().Should().NotThrowAsync();
    }

    private Phase SetupCompletableProject(string phaseStatus = PhaseStatus.Approved)
    {
        var project = new Project { ProjectId = ProjectId, Name = "Dự án VIP", Status = ProjectStatus.InProgress };
        var phase = new Phase { PhaseId = 1, ProjectId = ProjectId, Project = project, Status = phaseStatus };
        _mockProjectRepo.SetupMockData(new List<Project> { project });
        _mockPhaseRepo.SetupMockData(new List<Phase> { phase });
        return phase;
    }

    private Func<Task> CompleteAct()
        => () => _handler.Handle(new CompleteProjectCommand(ProjectId), CancellationToken.None);
}
