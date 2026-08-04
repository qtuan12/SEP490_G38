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
    public class RejectMaterialRequestCommandHandlerTests
    {
        private const long CurrentUserId = 20;
        private const long RequestId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<MaterialRequest>> _mockMRRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;

        private readonly RejectMaterialRequestCommandHandler _handler;

        public RejectMaterialRequestCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockMRRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);

            _handler = new RejectMaterialRequestCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_PendingStatusWithAccountantRole_ShouldRejectSuccessfully()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new RejectMaterialRequestCommand(RequestId, "Sai đơn giá/số lượng");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            mr.Status.Should().Be(MaterialRequestStatus.Rejected);
            mr.CheckedBy.Should().Be(CurrentUserId);
            mr.AccountantNote.Should().Be("Sai đơn giá/số lượng");

            _mockMRRepo.Verify(r => r.Update(mr), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_RequestNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest>().AsQueryable().BuildMock());
            var command = new RejectMaterialRequestCommand(999, "Reason");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID03_Handle_IncorrectRole_ShouldThrowForbiddenException()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            // Director is not allowed to reject Pending requests (only Accountant or Admin)
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Director);

            var command = new RejectMaterialRequestCommand(RequestId, "Director rejecting pending");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task UTCID04_Handle_EmptyReason_ShouldThrowBusinessException()
        {
            // Arrange
            var command = new RejectMaterialRequestCommand(RequestId, "   "); // Empty reason

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Bắt buộc phải nhập lý do từ chối yêu cầu.");
        }

        [Fact]
        public async Task UTCID05_Handle_InvalidStatus_ShouldThrowBusinessException()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Approved, // Already approved
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new RejectMaterialRequestCommand(RequestId, "Từ chối phiếu đã duyệt");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể từ chối yêu cầu vật tư đang ở trạng thái: Approved.*");
        }
    }
}
