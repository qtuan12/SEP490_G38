using AutoMapper;
using BPG.Application.Features.Projects.Handlers;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Projects
{
    public class CreateProjectCommandHandlerTests
    {
        private const long GeneratedProjectId = 101;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly CreateProjectCommandHandler _handler;

        public CreateProjectCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);

            _mockProjectRepo.Setup(r => r.AddAsync(It.IsAny<Project>(), It.IsAny<CancellationToken>()))
                .Callback<Project, CancellationToken>((p, _) => p.ProjectId = GeneratedProjectId)
                .Returns(Task.CompletedTask);

            _handler = new CreateProjectCommandHandler(
                _mockUow.Object,
                _mockMapper.Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldCreateDraftProject()
        {
            var command = new CreateProjectCommand
            {
                Name = "Dự án Tòa nhà X",
                Address = "123 Nguyễn Huệ, Q1, TP.HCM",
                PlannedStart = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
                PlannedEnd = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(100))
            };

            var result = await _handler.Handle(command, CancellationToken.None);

            _mockProjectRepo.Verify(r => r.AddAsync(It.Is<Project>(p => p.Name == command.Name && p.Status == ProjectStatus.Draft), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
