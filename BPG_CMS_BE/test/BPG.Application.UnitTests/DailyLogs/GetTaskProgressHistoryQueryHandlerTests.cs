using AutoMapper;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Handlers;
using BPG.Application.Features.DailyLogs.Queries;
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

namespace BPG.Application.UnitTests.DailyLogs
{
    public class GetTaskProgressHistoryQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskProgressLog>> _mockProgressLogRepo;

        private readonly GetTaskProgressHistoryQueryHandler _handler;

        public GetTaskProgressHistoryQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockProgressLogRepo = new Mock<IGenericRepository<TaskProgressLog>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskProgressLog>()).Returns(_mockProgressLogRepo.Object);

            // Default mock setups
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog>().AsQueryable().BuildMock());

            // Default mapper setup
            _mockMapper.Setup(m => m.Map<List<TaskProgressLogDto>>(It.IsAny<List<TaskProgressLog>>()))
                .Returns((List<TaskProgressLog> src) => src.Select(s => new TaskProgressLogDto
                {
                    TaskId = s.TaskId,
                    OldProgress = s.OldProgress,
                    NewProgress = s.NewProgress,
                    UpdateReason = s.UpdateReason,
                    UpdatedAt = s.UpdatedAt
                }).ToList());

            _handler = new GetTaskProgressHistoryQueryHandler(
                _mockUow.Object,
                _mockMapper.Object,
                _mockCurrentUserService.Object
            );
        }

        private void SetupCurrentUser(long userId, string role, bool isAdminOrTM = true)
        {
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(userId);
            _mockCurrentUserService.Setup(s => s.IsInAnyRole(It.IsAny<string[]>()))
                .Returns((string[] roles) => roles.Contains(role) && isAdminOrTM);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidId_ShouldReturnHistory()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin, isAdminOrTM: true);

            var project = new Project { ProjectId = 5 };
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var progressLogs = new List<TaskProgressLog>
            {
                new TaskProgressLog { TaskId = 100, OldProgress = 20, NewProgress = 50, UpdateReason = "Poured slab", UpdatedAt = DateTime.UtcNow }
            };
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(progressLogs.AsQueryable().BuildMock());

            var query = new GetTaskProgressHistoryQuery(100);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(1);
            result.First().NewProgress.Should().Be(50);
            result.First().OldProgress.Should().Be(20);
        }

        [Fact]
        public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var query = new GetTaskProgressHistoryQuery(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("ProjectTask với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_InsufficientPermission_ShouldThrowForbiddenException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.SiteEngineer, isAdminOrTM: false); // Engineer

            var project = new Project { ProjectId = 5 };
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // Not a project member
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());

            var query = new GetTaskProgressHistoryQuery(100);

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Bạn không phải thành viên của dự án này.");
        }
    }
}
