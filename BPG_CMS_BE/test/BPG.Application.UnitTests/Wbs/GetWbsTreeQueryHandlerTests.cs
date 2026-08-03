using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Features.Wbs.Handlers;
using BPG.Application.Features.Wbs.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MockQueryable.Moq;
using Moq;
using Xunit;

namespace BPG.Application.UnitTests.Wbs
{
    public class GetWbsTreeQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<BOQItem>> _mockBoqRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly GetWbsTreeQueryHandler _handler;

        public GetWbsTreeQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockBoqRepo = new Mock<IGenericRepository<BOQItem>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBoqRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);

            _handler = new GetWbsTreeQueryHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldReturnTree()
        {
            // Arrange
            var project = new Project { ProjectId = 1, PlannedStart = DateOnly.FromDateTime(DateTime.Today.AddDays(-10)) };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMockDbSet().Object);

            var phase = new Phase { PhaseId = 1, ProjectId = 1, Name = "Phase 1" };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMockDbSet().Object);

            var boq = new BOQItem 
            { 
                PhaseId = 1, 
                MaterialId = 10, 
                Quantity = 100, 
                UnitId = 1, 
                IsDeleted = false,
                Material = new MaterialCatalog { Name = "Mat 1" },
                Unit = new Unit { UnitName = "Kg" },
                Phase = phase
            };
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq }.AsQueryable().BuildMockDbSet().Object);

            var task = new ProjectTask
            {
                TaskId = 100,
                PhaseId = 1,
                Phase = phase,
                ParentTaskId = null,
                StartDate = DateOnly.FromDateTime(DateTime.Today.AddDays(-5)),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddDays(5)),
                Status = "InProgress",
                ProgressPercent = 50
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMockDbSet().Object);

            var query = new GetWbsTreeQuery(1);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(1, result.ProjectId);
            Assert.Single(result.Phases);
            var phaseDto = result.Phases.First();
            Assert.Equal("Phase 1", phaseDto.Name);
            Assert.Single(phaseDto.Tasks);
            Assert.Equal(50, phaseDto.ProgressPercent);
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project>().AsQueryable().BuildMockDbSet().Object);
            
            var query = new GetWbsTreeQuery(99);
            
            var ex = await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(query, CancellationToken.None));
            Assert.Contains("99", ex.Message);
        }

        [Fact]
        public async Task UTCID03_Handle_OverdueTask_ShouldSetIsOverdue()
        {
            // Arrange
            var project = new Project { ProjectId = 1, PlannedStart = DateOnly.FromDateTime(DateTime.Today.AddDays(-20)) };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMockDbSet().Object);

            var phase = new Phase { PhaseId = 1, ProjectId = 1 };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMockDbSet().Object);
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMockDbSet().Object);

            var overdueTask = new ProjectTask
            {
                TaskId = 101,
                PhaseId = 1,
                Phase = phase,
                StartDate = DateOnly.FromDateTime(DateTime.Today.AddDays(-10)),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddDays(-2)), // Deadline passed
                ProgressPercent = 50 // Not 100%
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { overdueTask }.AsQueryable().BuildMockDbSet().Object);

            // Act
            var result = await _handler.Handle(new GetWbsTreeQuery(1), CancellationToken.None);

            // Assert
            var taskDto = result.Phases.First().Tasks.First();
            Assert.True(taskDto.IsOverdue);
        }
    }
}
