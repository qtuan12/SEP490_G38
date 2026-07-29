using BPG.Application.Common.Models;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Handlers;
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

namespace BPG.Application.UnitTests.Tasks
{
    public class MarkTaskObsoleteCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IProgressRollupService> _mockRollupService;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;

        private readonly MarkTaskObsoleteCommandHandler _handler;

        public MarkTaskObsoleteCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockRollupService = new Mock<IProgressRollupService>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            // Technical Manager scenarios query the project leader for cross-notification.
            // Use an async-capable empty query by default; individual tests can override it.
            _mockMemberRepo.Setup(r => r.Query())
                .Returns(new List<ProjectMember>().AsQueryable().BuildMock());

            _handler = new MarkTaskObsoleteCommandHandler(
                _mockUow.Object,
                _mockRollupService.Object,
                _mockNotificationService.Object,
                _mockRealtimeSender.Object,
                _mockCurrentUserService.Object
            );
        }
        [Fact]
        public async Task UTCID04_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            
            var command = new MarkTaskObsoleteCommand(1, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>().WithMessage("*ProjectTask*1*");
        }
    }
}
