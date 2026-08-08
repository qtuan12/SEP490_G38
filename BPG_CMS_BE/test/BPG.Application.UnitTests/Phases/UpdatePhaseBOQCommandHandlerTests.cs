using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Features.Phases.Commands.UpdatePhaseBOQ;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using Xunit;

namespace BPG.Application.UnitTests.Phases
{
    public class UpdatePhaseBOQCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ILogger<UpdatePhaseBOQCommandHandler>> _mockLogger;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<BOQItem>> _mockBoqRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<MaterialConversion>> _mockConversionRepo;
        private readonly Mock<IGenericRepository<MaterialRequestItem>> _mockRequestItemRepo;
        private readonly Mock<IGenericRepository<DirectPurchaseItem>> _mockPurchaseItemRepo;
        private readonly Mock<IGenericRepository<MaterialIssuanceItem>> _mockIssuanceItemRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;

        private readonly UpdatePhaseBOQCommandHandler _handler;

        public UpdatePhaseBOQCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockLogger = new Mock<ILogger<UpdatePhaseBOQCommandHandler>>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockBoqRepo = new Mock<IGenericRepository<BOQItem>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockConversionRepo = new Mock<IGenericRepository<MaterialConversion>>();
            _mockRequestItemRepo = new Mock<IGenericRepository<MaterialRequestItem>>();
            _mockPurchaseItemRepo = new Mock<IGenericRepository<DirectPurchaseItem>>();
            _mockIssuanceItemRepo = new Mock<IGenericRepository<MaterialIssuanceItem>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBoqRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialConversion>()).Returns(_mockConversionRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(_mockRequestItemRepo.Object);
            _mockUow.Setup(u => u.Repository<DirectPurchaseItem>()).Returns(_mockPurchaseItemRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuanceItem>()).Returns(_mockIssuanceItemRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(1);

            _handler = new UpdatePhaseBOQCommandHandler(
                _mockUow.Object,
                _mockLogger.Object,
                _mockNotificationService.Object,
                _mockCurrentUserService.Object
            );
        }

        private void SetupBaseMocks()
        {
            var users = new List<User> { new User { UserId = 1, FullName = "Admin" } }.AsQueryable().BuildMockDbSet();
            _mockUserRepo.Setup(r => r.GetByIdAsync(It.IsAny<long>(), It.IsAny<CancellationToken>())).ReturnsAsync(users.Object.First());

            var members = new List<ProjectMember>().AsQueryable().BuildMockDbSet();
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.Object);
            _mockRequestItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMockDbSet().Object);
            _mockPurchaseItemRepo.Setup(r => r.Query()).Returns(new List<DirectPurchaseItem>().AsQueryable().BuildMockDbSet().Object);
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem>().AsQueryable().BuildMockDbSet().Object);
            _mockConversionRepo.Setup(r => r.Query()).Returns(new List<MaterialConversion>().AsQueryable().BuildMockDbSet().Object);
        }

        private UpdatePhaseBOQCommand Command(long phaseId = 1, long projectId = 1, List<BOQItemInput>? items = null)
        {
            return new UpdatePhaseBOQCommand(projectId, phaseId, items ?? new List<BOQItemInput>());
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldReturnTrue()
        {
            SetupBaseMocks();
            var phase = new Phase { PhaseId = 1, ProjectId = 1, Status = "Draft", Name = "Phase 1" };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMockDbSet().Object);
            
            var material = new MaterialCatalog { MaterialId = 10, BaseUnitId = 1, Name = "Mat 1" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMockDbSet().Object);

            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMockDbSet().Object);

            var command = Command(items: new List<BOQItemInput>
            {
                new BOQItemInput(10, 50, 1)
            });

            var result = await _handler.Handle(command, CancellationToken.None);

            Assert.True(result);
            _mockBoqRepo.Verify(r => r.AddAsync(It.Is<BOQItem>(b => b.MaterialId == 10 && b.Quantity == 50), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockNotificationService.Verify(n => n.SendNotificationToRoleAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase>().AsQueryable().BuildMockDbSet().Object);
            var command = Command(phaseId: 99);
            
            await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectNotDraft_ShouldThrowBusinessException()
        {
            var project = new Project { ProjectId = 1, Status = "Active" };
            var phase = new Phase { PhaseId = 1, ProjectId = 1, Project = project };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMockDbSet().Object);
            
            var command = Command();
            
            var ex = await Assert.ThrowsAsync<BusinessException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Equal("ERR_BOQ_NOT_DRAFT", ex.ErrorCode);
        }

        [Fact]
        public async Task UTCID04_Handle_DeleteInUseItem_ShouldThrowBusinessException()
        {
            SetupBaseMocks();
            var phase = new Phase { PhaseId = 1, ProjectId = 1, Status = "Draft" };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMockDbSet().Object);
            
            var boq = new BOQItem { PhaseId = 1, MaterialId = 10, IsDeleted = false };
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq }.AsQueryable().BuildMockDbSet().Object);

            var matReqItem = new MaterialRequestItem { MaterialId = 10, Request = new MaterialRequest { PhaseId = 1, IsDeleted = false } };
            _mockRequestItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem> { matReqItem }.AsQueryable().BuildMockDbSet().Object);

            var material = new MaterialCatalog { MaterialId = 10, BaseUnitId = 1, Name = "Mat 1" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMockDbSet().Object);

            // Emptry items means delete existing
            var command = Command(items: new List<BOQItemInput>());
            
            var ex = await Assert.ThrowsAsync<BusinessException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Equal("ERR_BOQ_ITEM_IN_USE", ex.ErrorCode);
        }

        [Fact]
        public async Task UTCID05_Handle_InvalidMaterialUnit_ShouldThrowBusinessException()
        {
            SetupBaseMocks();
            var phase = new Phase { PhaseId = 1, ProjectId = 1, Status = "Draft" };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMockDbSet().Object);
            
            var material = new MaterialCatalog { MaterialId = 10, BaseUnitId = 1 };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMockDbSet().Object);
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMockDbSet().Object);

            var command = Command(items: new List<BOQItemInput>
            {
                new BOQItemInput(10, 50, 2) // Unit diff, no conversion
            });

            var ex = await Assert.ThrowsAsync<BusinessException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Equal("ERR_INVALID_UNIT", ex.ErrorCode);
        }
    }
}
