using AutoMapper;
using BPG.Application.Features.Projects.Handlers;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Projects
{
    public class UpdateProjectCommandHandlerTests
    {
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly UpdateProjectCommandHandler _handler;

        public UpdateProjectCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockAttachmentRepo.SetupMockData(new List<Attachment>());

            _handler = new UpdateProjectCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                ServiceStubFactory.RealtimeSender());
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Project?)null);

            var command = new UpdateProjectCommand { ProjectId = ProjectId, Name = "Dự án mới" };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldUpdateProjectDetails()
        {
            var project = new Project
            {
                ProjectId = ProjectId,
                Name = "Tên cũ",
                Status = ProjectStatus.Draft
            };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var command = new UpdateProjectCommand
            {
                ProjectId = ProjectId,
                Name = "Tên mới",
                Address = "Địa chỉ mới"
            };

            var result = await _handler.Handle(command, CancellationToken.None);

            project.Name.Should().Be("Tên mới");
            project.Address.Should().Be("Địa chỉ mới");
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
