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
    public class ApproveMaterialRequestByDirectorCommandHandlerTests
    {
        private const long CurrentUserId = 30; // Director user ID
        private const long RequestId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<MaterialRequest>> _mockMRRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;

        private readonly ApproveMaterialRequestByDirectorCommandHandler _handler;

        public ApproveMaterialRequestByDirectorCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockMRRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            var mockMRItemRepo = new Mock<IGenericRepository<MaterialRequestItem>>();
            var mockBOQRepo = new Mock<IGenericRepository<BOQItem>>();
            mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());
            mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(mockMRItemRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(mockBOQRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Director);

            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            _handler = new ApproveMaterialRequestByDirectorCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_WaitingApproval_ShouldApproveSuccessfully()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.WaitingApproval,
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ApproveMaterialRequestByDirectorCommand(RequestId, "Duyệt yêu cầu vượt định mức");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            mr.Status.Should().Be(MaterialRequestStatus.Approved);
            mr.ApprovedBy.Should().Be(CurrentUserId);
            mr.ApprovalNote.Should().Be("Duyệt yêu cầu vượt định mức");

            _mockMRRepo.Verify(r => r.Update(mr), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task UTCID02_Handle_RequestNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest>().AsQueryable().BuildMock());
            var command = new ApproveMaterialRequestByDirectorCommand(999, "Note");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID03_Handle_InvalidStatus_ShouldThrowBusinessException()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending, // Waiting accountant process first
                Items = new List<MaterialRequestItem>()
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ApproveMaterialRequestByDirectorCommand(RequestId, "Duyệt");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Phiếu yêu cầu vật tư đang ở trạng thái: Pending. Chỉ hỗ trợ duyệt phiếu ở trạng thái Chờ Giám đốc duyệt (WaitingApproval).");
        }
    }
}
