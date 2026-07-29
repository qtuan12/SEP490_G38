using BPG.Application.Common.Models;
using BPG.Application.Features.Phases.Commands.CreatePhase;
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

            _mockPhaseRepo.Setup(r => r.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()))
                .Callback<Phase, CancellationToken>((phase, ct) => phase.PhaseId = 100)
                .Returns(Task.CompletedTask);

            _handler = new CreatePhaseCommandHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldCreatePhaseSuccessfully()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2026, 1, 1),
                PlannedEnd = new DateOnly(2026, 12, 31)
            };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(
                ProjectId: 1,
                Name: "Phase 1",
                Description: "Description",
                OrderIndex: 1,
                StartDate: new DateOnly(2026, 2, 1),
                EndDate: new DateOnly(2026, 11, 30)
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().Be(100);
            
            _mockPhaseRepo.Verify(r => r.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project>().AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(1, "Phase 1", null, 1, null, null);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("*Project*1*");

            _mockPhaseRepo.Verify(r => r.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_StartDateBeforePlannedStart_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2026, 2, 1),
                PlannedEnd = new DateOnly(2026, 12, 31)
            };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(1, "Phase 1", null, 1, new DateOnly(2026, 1, 1), null);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID04_Handle_EndDateAfterPlannedEnd_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2026, 1, 1),
                PlannedEnd = new DateOnly(2026, 11, 30)
            };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(1, "Phase 1", null, 1, null, new DateOnly(2026, 12, 1));

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID05_Handle_StartDateEqualsPlannedStart_ShouldCreateSuccessfully()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2026, 1, 1),
                PlannedEnd = new DateOnly(2026, 12, 31)
            };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(1, "Phase 1", null, 1, new DateOnly(2026, 1, 1), null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockPhaseRepo.Verify(r => r.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID06_Handle_EndDateEqualsPlannedEnd_ShouldCreateSuccessfully()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2026, 1, 1),
                PlannedEnd = new DateOnly(2026, 12, 31)
            };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(1, "Phase 1", null, 1, null, new DateOnly(2026, 12, 31));

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockPhaseRepo.Verify(r => r.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID07_Handle_NullDates_ShouldCreateSuccessfully()
        {
            // Arrange
            var project = new Project { ProjectId = 1 };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(1, "Phase 1", null, 1, null, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockPhaseRepo.Verify(r => r.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID08_Handle_MaxNameLength_ShouldCreateSuccessfully()
        {
            // Arrange
            var project = new Project { ProjectId = 1 };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var longName = new string('A', 200);
            var command = new CreatePhaseCommand(1, longName, null, 1, null, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockPhaseRepo.Verify(r => r.AddAsync(It.Is<Phase>(p => p.Name.Length == 200), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID09_Handle_OnlyStartDateHasValue_ShouldCreateSuccessfully()
        {
            // Arrange
            var project = new Project
            {
                ProjectId = 1,
                PlannedStart = new DateOnly(2026, 1, 1),
                PlannedEnd = new DateOnly(2026, 12, 31)
            };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var command = new CreatePhaseCommand(1, "Phase 1", null, 1, new DateOnly(2026, 5, 5), null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockPhaseRepo.Verify(r => r.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
