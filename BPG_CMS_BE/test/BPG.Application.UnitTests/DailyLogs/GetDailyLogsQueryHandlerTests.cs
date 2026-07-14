using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Handlers;
using BPG.Application.Features.DailyLogs.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
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

namespace BPG.Application.UnitTests.DailyLogs
{
    public class GetDailyLogsQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<DailyLog>> _mockLogRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<TaskProgressLog>> _mockProgressLogRepo;

        private readonly GetDailyLogsQueryHandler _handler;

        public GetDailyLogsQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();

            _mockLogRepo = new Mock<IGenericRepository<DailyLog>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockProgressLogRepo = new Mock<IGenericRepository<TaskProgressLog>>();

            _mockUow.Setup(u => u.Repository<DailyLog>()).Returns(_mockLogRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskProgressLog>()).Returns(_mockProgressLogRepo.Object);

            // Default mock setups
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog>().AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog>().AsQueryable().BuildMock());

            // Default mapper setup
            _mockMapper.Setup(m => m.Map<List<DailyLogDto>>(It.IsAny<List<DailyLog>>()))
                .Returns((List<DailyLog> src) => src.Select(s => new DailyLogDto
                {
                    LogId = s.LogId,
                    TaskId = s.TaskId,
                    NewProgressPercent = s.NewProgressPercent,
                    Description = s.Description,
                    CreatedAt = s.CreatedAt
                }).ToList());

            _handler = new GetDailyLogsQueryHandler(_mockUow.Object, _mockMapper.Object);
        }

        private List<DailyLog> GetMockLogs()
        {
            var project = new Project { ProjectId = 5 };
            var phase = new Phase { ProjectId = 5, Project = project };
            return new List<DailyLog>
            {
                new DailyLog
                {
                    LogId = 1,
                    TaskId = 100,
                    LogDate = new DateOnly(2026, 6, 20),
                    NewProgressPercent = 50,
                    Description = "Progress 50%",
                    CreatedBy = 10,
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    Task = new ProjectTask
                    {
                        TaskId = 100,
                        Name = "Task Alpha",
                        Phase = phase
                    }
                },
                new DailyLog
                {
                    LogId = 2,
                    TaskId = 101,
                    LogDate = new DateOnly(2026, 6, 21),
                    NewProgressPercent = 80,
                    Description = "Progress 80%",
                    CreatedBy = 20,
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    Task = new ProjectTask
                    {
                        TaskId = 101,
                        Name = "Task Beta",
                        Phase = phase
                    }
                }
            };
        }

        [Fact]
        public async Task UTCID01_Handle_NoFilters_ShouldReturnPagedList()
        {
            // Arrange
            var logs = GetMockLogs();
            _mockLogRepo.Setup(r => r.Query()).Returns(logs.AsQueryable().BuildMock());

            // Mock attachments (empty)
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());
            // Mock progress logs
            var progressLogs = new List<TaskProgressLog>
            {
                new TaskProgressLog { TaskId = 100, NewProgress = 50, OldProgress = 20, UpdatedAt = DateTime.UtcNow },
                new TaskProgressLog { TaskId = 101, NewProgress = 80, OldProgress = 50, UpdatedAt = DateTime.UtcNow }
            };
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(progressLogs.AsQueryable().BuildMock());

            var query = new GetDailyLogsQuery
            {
                ProjectId = 5,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(2);
            result.Items[0].LogId.Should().Be(2);
            result.Items[0].OldProgressPercent.Should().Be(50);

            result.Items[1].LogId.Should().Be(1);
            result.Items[1].OldProgressPercent.Should().Be(20);
        }

        [Fact]
        public async Task UTCID02_Handle_FilterByTaskIdWithChildren_ShouldReturnRecursivePagedList()
        {
            // Arrange
            var logs = GetMockLogs();
            _mockLogRepo.Setup(r => r.Query()).Returns(logs.AsQueryable().BuildMock());

            // Structure: Parent Task 90 has child 100, which has child 101.
            var parentTask = new ProjectTask { TaskId = 90, ParentTaskId = null, Phase = new Phase { ProjectId = 5 } };
            var task1 = new ProjectTask { TaskId = 100, ParentTaskId = 90, Phase = new Phase { ProjectId = 5 } };
            var task2 = new ProjectTask { TaskId = 101, ParentTaskId = 100, Phase = new Phase { ProjectId = 5 } };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask, task1, task2 }.AsQueryable().BuildMock());

            var query = new GetDailyLogsQuery
            {
                ProjectId = 5,
                TaskId = 90, // Queries logs for Task 90 and all its children/descendants (100, 101)
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(2); // Retrived logs for 100 and 101
        }

        [Fact]
        public async Task UTCID03_Handle_FilterByCreatedBy_ShouldReturnFilteredPagedList()
        {
            // Arrange
            var logs = GetMockLogs();
            _mockLogRepo.Setup(r => r.Query()).Returns(logs.AsQueryable().BuildMock());

            var query = new GetDailyLogsQuery
            {
                ProjectId = 5,
                CreatedBy = 10,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.Items.First().LogId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID04_Handle_FilterByLogDate_ShouldReturnFilteredPagedList()
        {
            // Arrange
            var logs = GetMockLogs();
            _mockLogRepo.Setup(r => r.Query()).Returns(logs.AsQueryable().BuildMock());

            var query = new GetDailyLogsQuery
            {
                ProjectId = 5,
                LogDate = new DateOnly(2026, 6, 21),
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.Items.First().LogId.Should().Be(2);
        }

        [Fact]
        public async Task UTCID05_Handle_CombinedFiltersWithNoMatches_ShouldReturnEmptyList()
        {
            // Arrange
            var logs = GetMockLogs();
            _mockLogRepo.Setup(r => r.Query()).Returns(logs.AsQueryable().BuildMock());

            var query = new GetDailyLogsQuery
            {
                ProjectId = 5,
                CreatedBy = 999, // User 999 has no logs
                LogDate = new DateOnly(2026, 6, 21)
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().BeEmpty();
        }

        [Fact]
        public async Task UTCID06_Handle_PageNumberOutOfBounds_ShouldReturnEmptyPagedList()
        {
            // Arrange
            var logs = GetMockLogs();
            _mockLogRepo.Setup(r => r.Query()).Returns(logs.AsQueryable().BuildMock());

            var query = new GetDailyLogsQuery
            {
                ProjectId = 5,
                PageNumber = 999, // Out of bounds page
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().BeEmpty();
        }
    }
}
