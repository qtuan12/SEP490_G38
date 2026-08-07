using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using System.Linq.Expressions;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.DirectPurchases
{
    public class CreateDirectPurchaseRequestCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 100;
        private const long PhaseId = 10;
        private const long GeneratedDpId = 700;
        private const long CementId = 50;
        private const int UnitId = 1;

        private static readonly DateOnly PurchaseDate = new(2026, 3, 10);

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo;
        private readonly Mock<IGenericRepository<DirectPurchaseItem>> _mockDpItemRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IDirectPurchaseFulfillmentService> _mockFulfillment;
        private readonly CreateDirectPurchaseRequestCommandHandler _handler;

        public CreateDirectPurchaseRequestCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDpRepo = new Mock<IGenericRepository<DirectPurchaseRequest>>();
            _mockDpItemRepo = new Mock<IGenericRepository<DirectPurchaseItem>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockFulfillment = new Mock<IDirectPurchaseFulfillmentService>();

            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);
            _mockUow.Setup(u => u.Repository<DirectPurchaseItem>()).Returns(_mockDpItemRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            _mockDpRepo.Setup(r => r.AddAsync(It.IsAny<DirectPurchaseRequest>(), It.IsAny<CancellationToken>()))
                .Callback<DirectPurchaseRequest, CancellationToken>((dp, _) => dp.DirectPurchaseId = GeneratedDpId)
                .Returns(Task.CompletedTask);
            _mockDpItemRepo.Setup(r => r.Query()).Returns(Array.Empty<DirectPurchaseItem>().AsQueryable().BuildMock());
            _mockDpItemRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<DirectPurchaseItem>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(Array.Empty<Attachment>().AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.AddAsync(It.IsAny<Attachment>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _mockFulfillment
                .Setup(f => f.ResolveItemsAsync(It.IsAny<long>(), It.IsAny<IReadOnlyList<DirectPurchaseItemInput>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((long _, IReadOnlyList<DirectPurchaseItemInput> items, CancellationToken __) =>
                    items.Select(i => new ResolvedDirectPurchaseItem
                    {
                        MaterialId = i.MaterialId,
                        MaterialName = "Xi măng PCB40",
                        UnitId = UnitId,
                        UnitName = "Bao",
                        Quantity = i.Quantity,
                        UnitPrice = i.UnitPrice
                    }).ToList());
            _mockFulfillment
                .Setup(f => f.EvaluateBoqAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<List<ResolvedDirectPurchaseItem>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            SetupTechnicalManager();
            SetupPhases(PhaseEntity());
            SetupProjects(ProjectEntity());
            SetupProjectMembers();

            _handler = new CreateDirectPurchaseRequestCommandHandler(
                _mockUow.Object, _mockCurrentUserService.Object, _mockFulfillment.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequestByTechnicalManager_ShouldReturnCreatedId()
        {
            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().Be(GeneratedDpId);
        }

        [Fact]
        public async Task UTCID02_Handle_ValidRequestByProjectLeader_ShouldReturnCreatedId()
        {
            SetupProjectLeader();

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().Be(GeneratedDpId);
        }

        [Fact]
        public async Task UTCID03_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            SetupPhases();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID04_Handle_PhaseNotInSelectedProject_ShouldThrowBusinessException()
        {
            var command = Command(projectId: 999);

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpPhaseProjectMismatch);
        }

        [Fact]
        public async Task UTCID05_Handle_UserIsNeitherTechnicalManagerNorProjectLeader_ShouldThrowForbiddenException()
        {
            SetupNonLeaderMember();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            SetupProjects();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Theory]
        [InlineData(ProjectStatus.Draft)]
        [InlineData(ProjectStatus.Paused)]
        [InlineData(ProjectStatus.Completed)]
        public async Task UTCID07_Handle_ProjectNotInProgress_ShouldThrowBusinessException(string projectStatus)
        {
            SetupProjects(ProjectEntity(projectStatus));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpProjectNotActive);
        }

        [Fact]
        public async Task UTCID08_Handle_PhaseAlreadyAccepted_ShouldThrowBusinessException()
        {
            SetupPhases(PhaseEntity(PhaseStatus.Approved));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpPhaseFrozen);
        }

        [Fact]
        public async Task UTCID09_Handle_DuplicateMaterialInItems_ShouldThrowBusinessException()
        {
            var command = Command(items: [Item(CementId, 5), Item(CementId, 3)]);

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpDuplicateMaterial);
        }

        private static CreateDirectPurchaseRequestCommand Command(
            long projectId = ProjectId,
            long phaseId = PhaseId,
            IEnumerable<DirectPurchaseItemInput>? items = null)
            => new()
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.",
                PurchaseDate = PurchaseDate,
                Items = items?.ToList() ?? [Item(CementId, 10)],
                InvoicePhotoUrls = ["https://cdn.bpg.vn/invoices/hd-01.jpg"]
            };

        private static DirectPurchaseItemInput Item(long materialId, decimal quantity)
            => new() { MaterialId = materialId, UnitId = UnitId, Quantity = quantity, UnitPrice = 1_500_000m };

        private static Phase PhaseEntity(string status = PhaseStatus.InProgress)
            => new() { PhaseId = PhaseId, ProjectId = ProjectId, Name = "Phần thô", Status = status };

        private static Project ProjectEntity(string status = ProjectStatus.InProgress)
            => new() { ProjectId = ProjectId, Name = "Nhà máy Bắc Ninh", Status = status };

        private void SetupTechnicalManager()
            => _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

        private void SetupProjectLeader()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });
        }

        private void SetupNonLeaderMember()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = false });
        }

        private void SetupPhases(params Phase[] phases)
            => _mockPhaseRepo.Setup(r => r.Query()).Returns(phases.AsQueryable().BuildMock());

        private void SetupProjects(params Project[] projects)
            => _mockProjectRepo.Setup(r => r.Query()).Returns(projects.AsQueryable().BuildMock());

        private void SetupProjectMembers(params ProjectMember[] members)
            => _mockMemberRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((Expression<Func<ProjectMember, bool>> predicate, CancellationToken _) =>
                    members.AsQueryable().Any(predicate));
    }
}
