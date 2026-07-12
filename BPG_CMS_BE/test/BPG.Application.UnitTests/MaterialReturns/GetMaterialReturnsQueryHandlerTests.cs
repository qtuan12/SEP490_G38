using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.Features.MaterialReturns.Handlers;
using BPG.Application.Features.MaterialReturns.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.MaterialReturns
{
    public class GetMaterialReturnsQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialReturn>> _mockReturnRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly GetMaterialReturnsQueryHandler _handler;

        public GetMaterialReturnsQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockReturnRepo = new Mock<IGenericRepository<MaterialReturn>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialReturn>()).Returns(_mockReturnRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new GetMaterialReturnsQueryHandler(_mockUow.Object);
        }

        private List<MaterialReturn> GetMockReturnsList()
        {
            return new List<MaterialReturn>
            {
                new MaterialReturn
                {
                    MaterialReturnId = 1,
                    ReturnNo = "PTRA-001",
                    Reason = "Excess cement",
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    CreatedBy = 10,
                    OriginalIssuanceId = 100,
                    OriginalIssuance = new MaterialIssuance
                    {
                        IssuanceNo = "PXK-100",
                        Task = new ProjectTask
                        {
                            Name = "Concrete pouring",
                            Phase = new Phase { ProjectId = 5 }
                        }
                    },
                    Items = new List<MaterialReturnItem>
                    {
                        new MaterialReturnItem { MaterialId = 50, Quantity = 5 }
                    }
                },
                new MaterialReturn
                {
                    MaterialReturnId = 2,
                    ReturnNo = "PTRA-002",
                    Reason = "Defective bricks",
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    CreatedBy = 20,
                    OriginalIssuanceId = 200,
                    OriginalIssuance = new MaterialIssuance
                    {
                        IssuanceNo = "PXK-200",
                        Task = new ProjectTask
                        {
                            Name = "Masonry work",
                            Phase = new Phase { ProjectId = 6 }
                        }
                    },
                    Items = new List<MaterialReturnItem>
                    {
                        new MaterialReturnItem { MaterialId = 50, Quantity = 2 }
                    }
                }
            };
        }

        private List<User> GetMockUsersList()
        {
            return new List<User>
            {
                new User { UserId = 10, FullName = "Admin User" },
                new User { UserId = 20, FullName = "TM User" }
            };
        }

        [Fact]
        public async Task UTCID01_Handle_NoFilters_ShouldReturnPagedList()
        {
            // Arrange
            var returns = GetMockReturnsList();
            _mockReturnRepo.Setup(r => r.Query()).Returns(returns.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialReturnsQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Count.Should().Be(2);
            result.TotalCount.Should().Be(2);

            result.Items[0].ReturnNo.Should().Be("PTRA-001");
            result.Items[0].CreatedByName.Should().Be("Admin User");

            result.Items[1].ReturnNo.Should().Be("PTRA-002");
            result.Items[1].CreatedByName.Should().Be("TM User");
        }

        [Fact]
        public async Task UTCID02_Handle_FilterByProject_ShouldReturnFilteredPagedList()
        {
            // Arrange
            var returns = GetMockReturnsList();
            _mockReturnRepo.Setup(r => r.Query()).Returns(returns.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialReturnsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                ProjectId = 5
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialReturnId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID03_Handle_FilterByIssuance_ShouldReturnFilteredPagedList()
        {
            // Arrange
            var returns = GetMockReturnsList();
            _mockReturnRepo.Setup(r => r.Query()).Returns(returns.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialReturnsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                IssuanceId = 200 // maps to original issuance 200 (material return id 2)
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialReturnId.Should().Be(2);
        }

        [Fact]
        public async Task UTCID04_Handle_SearchByReturnNo_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var returns = GetMockReturnsList();
            _mockReturnRepo.Setup(r => r.Query()).Returns(returns.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialReturnsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "PTRA-002"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialReturnId.Should().Be(2);
        }

        [Fact]
        public async Task UTCID05_Handle_SearchByReason_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var returns = GetMockReturnsList();
            _mockReturnRepo.Setup(r => r.Query()).Returns(returns.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialReturnsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "excess"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialReturnId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID06_Handle_SearchByIssuanceNo_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var returns = GetMockReturnsList();
            _mockReturnRepo.Setup(r => r.Query()).Returns(returns.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialReturnsQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "PXK-100"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialReturnId.Should().Be(1);
        }
    }
}
