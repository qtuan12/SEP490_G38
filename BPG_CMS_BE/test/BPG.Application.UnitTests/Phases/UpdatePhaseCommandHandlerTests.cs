using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Features.Phases.Commands.UpdatePhase;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MockQueryable.Moq;
using Moq;
using Xunit;

namespace BPG.Application.UnitTests.Phases
{
    public class UpdatePhaseCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly UpdatePhaseCommandHandler _handler;

        public UpdatePhaseCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();

            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);

            _handler = new UpdatePhaseCommandHandler(_mockUow.Object);
        }

        private UpdatePhaseCommand Command(
            long phaseId = 1,
            string name = "Updated Phase",
            string? description = null,
            int orderIndex = 1,
            DateOnly? startDate = null,
            DateOnly? endDate = null,
            int status = 0)
        {
            return new UpdatePhaseCommand(phaseId, name, description, orderIndex, startDate, endDate, status);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldReturnSuccess()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Name = "Old Name",
                Tasks = new List<ProjectTask>()
            };
            var phaseDbSet = new List<Phase> { phase }.AsQueryable().BuildMockDbSet();
            _mockPhaseRepo.Setup(r => r.Query()).Returns(phaseDbSet.Object);

            var command = Command();

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            Assert.True(result.Success);
            _mockPhaseRepo.Verify(r => r.Update(It.Is<Phase>(p => p.Name == "Updated Phase")), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            var phaseDbSet = new List<Phase>().AsQueryable().BuildMockDbSet();
            _mockPhaseRepo.Setup(r => r.Query()).Returns(phaseDbSet.Object);

            var command = Command(phaseId: 99);

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var ex = await Assert.ThrowsAsync<NotFoundException>(act);
            Assert.Contains("99", ex.Message);
        }

        [Fact]
        public async Task UTCID03_Handle_HasInProgressTasks_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase
            {
                PhaseId = 1,
                Name = "Phase 1",
                Tasks = new List<ProjectTask>
                {
                    new ProjectTask { TaskId = 10, ProgressPercent = 50 }
                }
            };
            var phaseDbSet = new List<Phase> { phase }.AsQueryable().BuildMockDbSet();
            _mockPhaseRepo.Setup(r => r.Query()).Returns(phaseDbSet.Object);

            var command = Command();

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var ex = await Assert.ThrowsAsync<BusinessException>(act);
            Assert.Equal("ERR_PHASE_HAS_IN_PROGRESS_TASKS", ex.ErrorCode);
        }
    }
}
