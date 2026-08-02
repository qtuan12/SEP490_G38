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
using System.Threading;
using System.Threading.Tasks;
using RoleConstants = BPG.Domain.Constants.UserRole;
using Xunit;

namespace BPG.Application.UnitTests.MaterialRequests
{
    public class ProcessMaterialRequestByAccountantCommandHandlerTests
    {
        private const long CurrentUserId = 20; // Accountant user ID
        private const long RequestId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<MaterialRequest>> _mockMRRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;

        private readonly ProcessMaterialRequestByAccountantCommandHandler _handler;

        public ProcessMaterialRequestByAccountantCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockMRRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);

            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            _handler = new ProcessMaterialRequestByAccountantCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_WithinBOQ_ShouldApproveDirectly()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ProcessMaterialRequestByAccountantCommand(RequestId, "Duyệt yêu cầu");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            mr.Status.Should().Be(MaterialRequestStatus.Approved);
            mr.CheckedBy.Should().Be(CurrentUserId);
            mr.ApprovedBy.Should().Be(CurrentUserId);

            _mockMRRepo.Verify(r => r.Update(mr), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_RequestNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest>().AsQueryable().BuildMock());
            var command = new ProcessMaterialRequestByAccountantCommand(999, "Note");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID03_Handle_OverBOQ_ShouldPromoteToWaitingApproval()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                BOQCheckStatus = BOQCheckStatus.OverBOQ,
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ProcessMaterialRequestByAccountantCommand(RequestId, "Trình Giám đốc");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            mr.Status.Should().Be(MaterialRequestStatus.WaitingApproval);
            mr.CheckedBy.Should().Be(CurrentUserId);
            mr.ApprovedBy.Should().BeNull(); // Not approved yet

            _mockMRRepo.Verify(r => r.Update(mr), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID04_Handle_InvalidStatus_ShouldThrowBusinessException()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Approved, // Already approved
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ProcessMaterialRequestByAccountantCommand(RequestId, "Duyệt lại");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Phiếu yêu cầu vật tư đang ở trạng thái: Approved. Chỉ hỗ trợ xử lý phiếu ở trạng thái Chờ duyệt (Pending).");
        }
    }
}
