using BPG.Application.DTOs;
using BPG.Application.Features.PhaseAcceptances.Commands.AcceptPhase;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RoleConstants = BPG.Domain.Constants.UserRole;
using Xunit;
using TaskStatus = BPG.Domain.Constants.TaskStatus;

namespace BPG.Application.UnitTests.PhaseAcceptances
{
    public class AcceptPhaseCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long PhaseId = 10;
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IPdfService> _mockPdfService;
        private readonly Mock<IFileStorageService> _mockFileStorageService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<PhaseAcceptance>> _mockAcceptanceRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockProjectMemberRepo;

        private readonly AcceptPhaseCommandHandler _handler;

        public AcceptPhaseCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockPdfService = new Mock<IPdfService>();
            _mockFileStorageService = new Mock<IFileStorageService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockAcceptanceRepo = new Mock<IGenericRepository<PhaseAcceptance>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockProjectMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<PhaseAcceptance>()).Returns(_mockAcceptanceRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockProjectMemberRepo.Object);
            _mockUow.Setup(u => u.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.ExecuteSqlAsync(
                    It.IsAny<FormattableString>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            // PDF & File storage mockup
            _mockPdfService.Setup(x => x.GeneratePhaseAcceptancePdf(It.IsAny<PhaseAcceptancePdfModel>()))
                .Returns(new byte[] { 1, 2, 3 });
            _mockFileStorageService.Setup(x => x.UploadFileAsync(It.IsAny<byte[]>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("http://storage.com/acceptance.pdf");

            // Acceptance ID auto-generation
            _mockAcceptanceRepo.Setup(r => r.AddAsync(It.IsAny<PhaseAcceptance>(), It.IsAny<CancellationToken>()))
                .Callback<PhaseAcceptance, CancellationToken>((acc, ct) => acc.AcceptanceId = 50)
                .Returns(Task.CompletedTask);

            _handler = new AcceptPhaseCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockPdfService.Object,
                _mockFileStorageService.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldAcceptPhaseSuccessfully()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = PhaseId,
                ProjectId = ProjectId,
                Name = "Giai đoạn 1",
                Status = PhaseStatus.InProgress,
                Project = new Project { ProjectId = ProjectId, Name = "Dự án A", Status = ProjectStatus.InProgress }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var task = new ProjectTask
            {
                PhaseId = PhaseId,
                Name = "Xây móng",
                ProgressPercent = 100,
                Status = TaskStatus.InProgress,
                Assignees = new List<TaskAssignee>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var user = new User { UserId = CurrentUserId, FullName = "Nguyễn Văn A" };
            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

            var command = new AcceptPhaseCommand(PhaseId, "Nghiệm thu hoàn thành giai đoạn 1");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().Be(50);
            phase.Status.Should().Be(PhaseStatus.Approved);

            _mockAcceptanceRepo.Verify(r => r.AddAsync(It.IsAny<PhaseAcceptance>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_Director_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Director);

            Func<Task> act = () => _handler.Handle(
                new AcceptPhaseCommand(PhaseId, "Nghiệm thu giai đoạn"),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
        }

        [Fact]
        public async Task UTCID03_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase>().AsQueryable().BuildMock());
            var command = new AcceptPhaseCommand(999, "Giai đoạn không tồn tại");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
            _mockAcceptanceRepo.Verify(r => r.AddAsync(It.IsAny<PhaseAcceptance>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID04_Handle_PhaseAlreadyApproved_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = PhaseId,
                Status = PhaseStatus.Approved,
                Project = new Project { Status = ProjectStatus.InProgress }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            var command = new AcceptPhaseCommand(PhaseId, "Giai đoạn đã hoàn thành");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Phase này đã được nghiệm thu và hoàn thành trước đó.");
        }

        [Fact]
        public async Task UTCID05_Handle_PhaseHasNoActiveTasks_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = PhaseId,
                Status = PhaseStatus.InProgress,
                Project = new Project { Status = ProjectStatus.InProgress }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            // Only obsolete tasks exist
            var task = new ProjectTask
            {
                PhaseId = PhaseId,
                Status = TaskStatus.Obsolete
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new AcceptPhaseCommand(PhaseId, "Không có task hoạt động");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể nghiệm thu Phase chưa có công việc hoạt động nào.");
        }

        [Fact]
        public async Task UTCID06_Handle_PhaseHasIncompleteTasks_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = PhaseId,
                Status = PhaseStatus.InProgress,
                Project = new Project { Status = ProjectStatus.InProgress }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var task1 = new ProjectTask { PhaseId = PhaseId, Status = TaskStatus.InProgress, ProgressPercent = 100 };
            var task2 = new ProjectTask { PhaseId = PhaseId, Status = TaskStatus.InProgress, ProgressPercent = 80 }; // Incomplete
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task1, task2 }.AsQueryable().BuildMock());

            var command = new AcceptPhaseCommand(PhaseId, "Có task chưa xong");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể nghiệm thu Phase khi chưa hoàn thành 100% tất cả các công việc hoạt động.");
        }

        [Fact]
        public async Task UTCID07_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = PhaseId,
                Status = PhaseStatus.InProgress,
                Project = new Project { Status = ProjectStatus.Paused } // project is paused
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new AcceptPhaseCommand(PhaseId, "Nghiệm thu");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
        }

        [Fact]
        public async Task UTCID08_Handle_CompletedActiveTaskAndIncompleteObsoleteTask_ShouldAcceptPhaseSuccessfully()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = PhaseId,
                ProjectId = ProjectId,
                Name = "Giai đoạn 1",
                Status = PhaseStatus.InProgress,
                Project = new Project { ProjectId = ProjectId, Name = "Dự án A", Status = ProjectStatus.InProgress }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var tasks = new List<ProjectTask>
            {
                new()
                {
                    PhaseId = PhaseId,
                    Name = "Công việc còn hiệu lực",
                    ProgressPercent = 100,
                    Status = TaskStatus.Completed,
                    Assignees = new List<TaskAssignee>()
                },
                new()
                {
                    PhaseId = PhaseId,
                    Name = "Công việc đã tạm dừng",
                    ProgressPercent = 20,
                    Status = TaskStatus.Obsolete,
                    Assignees = new List<TaskAssignee>()
                }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new User { UserId = CurrentUserId, FullName = "Nguyễn Văn A" });

            // Act
            var result = await _handler.Handle(
                new AcceptPhaseCommand(PhaseId, "Nghiệm thu các công việc còn hiệu lực"),
                CancellationToken.None);

            // Assert
            result.Should().Be(50);
        }

    }
}
