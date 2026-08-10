using AutoMapper;
using BPG.Application.Features.Incidents.Commands.CreateAndAssessIncident;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Incidents
{
    public class CreateAndAssessIncidentCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly List<Incident> _incidentList;
        private readonly CreateAndAssessIncidentCommandHandler _handler;

        public CreateAndAssessIncidentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockMapper = new Mock<IMapper>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<Incident>()).Returns(_mockIncidentRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _mockCurrentUserService.Setup(c => c.UserId).Returns(CurrentUserId);
            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(CurrentUserId);
            _mockCurrentUserService.Setup(c => c.IsInRole(It.IsAny<string>())).Returns(true);

            _mockProjectRepo.SetupMockData(new List<Project>());
            _mockMemberRepo.SetupMockData(new List<ProjectMember>());
            _mockTaskRepo.SetupMockData(new List<ProjectTask>());
            _mockPhaseRepo.SetupMockData(new List<Phase>());
            _mockUserRepo.SetupMockData(new List<User>());

            _incidentList = new List<Incident>();
            _mockIncidentRepo.SetupMockData(_incidentList);
            _mockIncidentRepo.Setup(r => r.AddAsync(It.IsAny<Incident>(), It.IsAny<CancellationToken>()))
                .Callback<Incident, CancellationToken>((inc, _) =>
                {
                    inc.IncidentId = 50;
                    _incidentList.Add(inc);
                })
                .Returns(Task.CompletedTask);

            _handler = new CreateAndAssessIncidentCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.NotificationService(),
                ServiceStubFactory.RealtimeSender());
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockProjectRepo.SetupMockData(new List<Project>());

            var command = new CreateAndAssessIncidentCommand(
                ProjectId, null, null, "Construction", "Mô tả sự cố", null, null, null, null, null, false);

            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_ValidConstructionIncident_ShouldCreateIncident()
        {
            var project = new Project { ProjectId = ProjectId, Name = "Dự án B" };
            _mockProjectRepo.SetupMockData(new List<Project> { project });

            var command = new CreateAndAssessIncidentCommand(
                ProjectId, null, null, "Construction", "Máy hỏng động cơ", null, null, null, null, null, false);

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockIncidentRepo.Verify(r => r.AddAsync(It.Is<Incident>(i => i.Description == command.Description), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce());
        }
    }
}
