using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialRequests.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
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
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using RoleConstants = BPG.Domain.Constants.UserRole;
using Xunit;

namespace BPG.Application.UnitTests.MaterialRequests
{
    public class CancelMaterialRequestCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long RequestId = 100;
        private const long ProjectId = 1;
        private const long PhaseId = 10;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<MaterialRequest>> _mockMRRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;

        private readonly CancelMaterialRequestCommandHandler _handler;

        public CancelMaterialRequestCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockMRRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            var mockMRItemRepo = new Mock<IGenericRepository<MaterialRequestItem>>();
            var mockBOQRepo = new Mock<IGenericRepository<BOQItem>>();
            mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());
            mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(mockMRItemRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(mockBOQRepo.Object);

            SetupProjectLeader(true);

            _handler = new CancelMaterialRequestCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object
            );
        }

        private void SetupProjectLeader(bool isLeader)
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            var member = new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = isLeader };
            var membersList = new List<ProjectMember> { member };
            _mockMemberRepo.Setup(r => r.Query()).Returns(membersList.AsQueryable().BuildMock());
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_AsProjectLeader_ShouldCancelSuccessfully()
        {
            // Arrange
            SetupProjectLeader(true);

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId };
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                Phase = phase,
                CreatedBy = CurrentUserId
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new CancelMaterialRequestCommand(RequestId, "Không cần thiết nữa");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            mr.Status.Should().Be(MaterialRequestStatus.Cancelled);
            mr.AccountantNote.Should().Be("Không cần thiết nữa");
            mr.UpdatedBy.Should().Be(CurrentUserId);

            _mockMRRepo.Verify(r => r.Update(mr), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task UTCID02_Handle_NotProjectLeader_ShouldThrowForbiddenException()
        {
            // Arrange
            SetupProjectLeader(false);

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId };
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                Phase = phase,
                CreatedBy = CurrentUserId
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new CancelMaterialRequestCommand(RequestId, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ Trưởng dự án mới được hủy yêu cầu vật tư.");

            _mockMRRepo.Verify(r => r.Update(It.IsAny<MaterialRequest>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_InvalidStatus_ShouldThrowBusinessException()
        {
            // Arrange
            SetupProjectLeader(true);

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId };
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Approved, // Already approved, cannot cancel
                Phase = phase,
                CreatedBy = CurrentUserId
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new CancelMaterialRequestCommand(RequestId, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Chỉ hỗ trợ hủy phiếu ở trạng thái Chờ duyệt*");

            _mockMRRepo.Verify(r => r.Update(It.IsAny<MaterialRequest>()), Times.Never);
        }

        [Fact]
        public async Task UTCID04_Handle_RequestNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest>().AsQueryable().BuildMock());

            var command = new CancelMaterialRequestCommand(999, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }
    }
}
