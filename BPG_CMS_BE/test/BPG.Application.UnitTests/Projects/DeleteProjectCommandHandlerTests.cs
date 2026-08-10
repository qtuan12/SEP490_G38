using BPG.Application.Features.Projects.Handlers;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Projects
{
    public class DeleteProjectCommandHandlerTests
    {
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly DeleteProjectCommandHandler _handler;

        public DeleteProjectCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);

            _handler = new DeleteProjectCommandHandler(_mockUow.Object);
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Project?)null);

            var command = new DeleteProjectCommand { ProjectId = ProjectId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_ProjectNotInDraft_ShouldThrowBusinessException()
        {
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var command = new DeleteProjectCommand { ProjectId = ProjectId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<BusinessException>();
            ex.Which.ErrorCode.Should().Be("ERR_PROJECT_DELETE");
        }

        [Fact]
        public async Task Handle_DraftProject_ShouldDelete()
        {
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Draft, IsDeleted = false };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var command = new DeleteProjectCommand { ProjectId = ProjectId };
            var result = await _handler.Handle(command, CancellationToken.None);

            result.Should().BeTrue();
            _mockProjectRepo.Verify(r => r.Remove(project), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
