using BPG.Application.Common.Models;
using BPG.Application.Features.Phases.Commands.DeletePhase;
using BPG.Application.IRepositories;
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

namespace BPG.Application.UnitTests.Phases
{
    public class DeletePhaseCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly DeletePhaseCommandHandler _handler;

        public DeletePhaseCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();

            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);

            _handler = new DeletePhaseCommandHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidPhaseAndTasksWithZeroProgress_ShouldDeleteSuccessfully()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Status = BPG.Domain.Constants.PhaseStatus.Draft,
                Tasks = new List<ProjectTask>
                {
                    new ProjectTask { TaskId = 1, ProgressPercent = 0 },
                    new ProjectTask { TaskId = 2, ProgressPercent = 0 }
                }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new DeletePhaseCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(It.IsAny<ProjectTask>()), Times.Exactly(2));
            _mockPhaseRepo.Verify(r => r.Remove(phase), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase>().AsQueryable().BuildMock());

            var command = new DeletePhaseCommand(1);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("*Phase*1*");

            _mockPhaseRepo.Verify(r => r.Remove(It.IsAny<Phase>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_PhaseHasInProgressTask_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Status = BPG.Domain.Constants.PhaseStatus.Draft,
                Tasks = new List<ProjectTask>
                {
                    new ProjectTask { TaskId = 1, ProgressPercent = 50 }
                }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new DeletePhaseCommand(1);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể xóa phase vì đã có task đang được thực hiện*");

            _mockPhaseRepo.Verify(r => r.Remove(It.IsAny<Phase>()), Times.Never);
        }

        [Fact]
        public async Task UTCID04_Handle_PhaseEmptyNoTasks_ShouldDeleteSuccessfully()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Status = BPG.Domain.Constants.PhaseStatus.Draft,
                Tasks = new List<ProjectTask>()
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new DeletePhaseCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(It.IsAny<ProjectTask>()), Times.Never);
            _mockPhaseRepo.Verify(r => r.Remove(phase), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID05_Handle_PhaseWithMultipleZeroProgressTasks_ShouldRemoveAllTasks()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Status = BPG.Domain.Constants.PhaseStatus.Draft,
                Tasks = new List<ProjectTask>
                {
                    new ProjectTask { TaskId = 1, ProgressPercent = 0 },
                    new ProjectTask { TaskId = 2, ProgressPercent = 0 },
                    new ProjectTask { TaskId = 3, ProgressPercent = 0 }
                }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new DeletePhaseCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(It.IsAny<ProjectTask>()), Times.Exactly(3));
            _mockPhaseRepo.Verify(r => r.Remove(phase), Times.Once);
        }

        [Fact]
        public async Task UTCID06_Handle_MixedProgressTasks_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Status = BPG.Domain.Constants.PhaseStatus.Draft,
                Tasks = new List<ProjectTask>
                {
                    new ProjectTask { TaskId = 1, ProgressPercent = 0 },
                    new ProjectTask { TaskId = 2, ProgressPercent = 10 }
                }
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new DeletePhaseCommand(1);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể xóa phase vì đã có task đang được thực hiện*");
        }

        [Fact]
        public async Task UTCID07_Handle_PhaseIsApproved_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Status = BPG.Domain.Constants.PhaseStatus.Approved, // Or Accepted, whatever is defined
                Tasks = new List<ProjectTask>()
            };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new DeletePhaseCommand(1);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            // This test is expected to fail currently because the logic to prevent deleting approved phases is missing
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể xóa phase đã nghiệm thu*");
        }
    }
}
