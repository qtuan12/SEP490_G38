using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialIssuances;
using BPG.Application.Features.MaterialIssuances.Handlers;
using BPG.Application.Features.MaterialIssuances.Queries;
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

namespace BPG.Application.UnitTests.MaterialIssuances
{
    public class GetMaterialIssuancesQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly GetMaterialIssuancesQueryHandler _handler;

        public GetMaterialIssuancesQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new GetMaterialIssuancesQueryHandler(_mockUow.Object);
        }

        private List<MaterialIssuance> GetMockIssuancesList()
        {
            return new List<MaterialIssuance>
            {
                new MaterialIssuance
                {
                    MaterialIssuanceId = 1,
                    IssuanceNo = "PXK-001",
                    Purpose = "Pour Slab",
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    CreatedBy = 10,
                    Task = new ProjectTask
                    {
                        Name = "Concrete pouring",
                        Phase = new Phase { ProjectId = 5 }
                    },
                    Items = new List<MaterialIssuanceItem>
                    {
                        new MaterialIssuanceItem { MaterialId = 50, Quantity = 10 }
                    }
                },
                new MaterialIssuance
                {
                    MaterialIssuanceId = 2,
                    IssuanceNo = "PXK-002",
                    Purpose = "Build Wall",
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    CreatedBy = 20,
                    Task = new ProjectTask
                    {
                        Name = "Masonry work",
                        Phase = new Phase { ProjectId = 6 }
                    },
                    Items = new List<MaterialIssuanceItem>
                    {
                        new MaterialIssuanceItem { MaterialId = 50, Quantity = 5 }
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
            var issuances = GetMockIssuancesList();
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(issuances.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialIssuancesQuery
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

            result.Items[0].IssuanceNo.Should().Be("PXK-001");
            result.Items[0].CreatedByName.Should().Be("Admin User");

            result.Items[1].IssuanceNo.Should().Be("PXK-002");
            result.Items[1].CreatedByName.Should().Be("TM User");
        }

        [Fact]
        public async Task UTCID02_Handle_FilterByProject_ShouldReturnFilteredPagedList()
        {
            // Arrange
            var issuances = GetMockIssuancesList();
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(issuances.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialIssuancesQuery
            {
                PageNumber = 1,
                PageSize = 10,
                ProjectId = 5
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialIssuanceId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID03_Handle_SearchByTaskName_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var issuances = GetMockIssuancesList();
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(issuances.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialIssuancesQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "concrete"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialIssuanceId.Should().Be(1);
        }

        [Fact]
        public async Task UTCID04_Handle_SearchByPurpose_ShouldReturnMatchingPagedList()
        {
            // Arrange
            var issuances = GetMockIssuancesList();
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(issuances.AsQueryable().BuildMock());

            var users = GetMockUsersList();
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var query = new GetMaterialIssuancesQuery
            {
                PageNumber = 1,
                PageSize = 10,
                Search = "wall"
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Count.Should().Be(1);
            result.Items[0].MaterialIssuanceId.Should().Be(2);
        }
    }
}
