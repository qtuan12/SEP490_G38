using System;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Features.Phases.Commands.CreatePhase;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Moq;
using Xunit;
using Microsoft.EntityFrameworkCore;
using MockQueryable.Moq;
using System.Collections.Generic;
using System.Linq;

namespace BPG.Application.UnitTests.Phases
{
    public class CreatePhaseCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly CreatePhaseCommandHandler _handler;

        public CreatePhaseCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);

            _handler = new CreatePhaseCommandHandler(_mockUow.Object);
        }

        private CreatePhaseCommand Command(
            long projectId = 1,
            string name = "Test Phase",
            string? description = null,
            int orderIndex = 1,
            DateOnly? startDate = null,
            DateOnly? endDate = null)
        {
            return new CreatePhaseCommand(projectId, name, description, orderIndex, startDate, endDate);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldReturnSuccess()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2024, 1, 1),
                PlannedEnd = new DateOnly(2024, 12, 31)
            };
            var projectDbSet = new List<Project> { project }.AsQueryable().BuildMockDbSet();
            _mockProjectRepo.Setup(r => r.Query()).Returns(projectDbSet.Object);

            var command = Command(startDate: new DateOnly(2024, 2, 1), endDate: new DateOnly(2024, 11, 30));

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            Assert.True(result.Success);
            _mockPhaseRepo.Verify(r => r.AddAsync(It.Is<Phase>(p => p.Name == "Test Phase"), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            var projectDbSet = new List<Project>().AsQueryable().BuildMockDbSet();
            _mockProjectRepo.Setup(r => r.Query()).Returns(projectDbSet.Object);

            var command = Command(projectId: 99);

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var ex = await Assert.ThrowsAsync<NotFoundException>(act);
            Assert.Contains("99", ex.Message);
        }

        [Fact]
        public async Task UTCID03_Handle_StartDateBeforeProjectStart_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2024, 1, 1),
                PlannedEnd = new DateOnly(2024, 12, 31)
            };
            var projectDbSet = new List<Project> { project }.AsQueryable().BuildMockDbSet();
            _mockProjectRepo.Setup(r => r.Query()).Returns(projectDbSet.Object);

            var command = Command(startDate: new DateOnly(2023, 12, 31));

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var ex = await Assert.ThrowsAsync<BusinessException>(act);
            Assert.Equal("ERR_PHASE_DATE_INVALID", ex.ErrorCode);
        }

        [Fact]
        public async Task UTCID04_Handle_EndDateAfterProjectEnd_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2024, 1, 1),
                PlannedEnd = new DateOnly(2024, 12, 31)
            };
            var projectDbSet = new List<Project> { project }.AsQueryable().BuildMockDbSet();
            _mockProjectRepo.Setup(r => r.Query()).Returns(projectDbSet.Object);

            var command = Command(endDate: new DateOnly(2025, 1, 1));

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var ex = await Assert.ThrowsAsync<BusinessException>(act);
            Assert.Equal("ERR_PHASE_DATE_INVALID", ex.ErrorCode);
        }
    }
}
