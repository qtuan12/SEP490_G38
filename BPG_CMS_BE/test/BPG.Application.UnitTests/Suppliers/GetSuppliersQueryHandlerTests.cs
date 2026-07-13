using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.Features.Suppliers.Handlers;
using BPG.Application.Features.Suppliers.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.Suppliers
{
    public class GetSuppliersQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Supplier>> _mockSupplierRepo;
        private readonly IMapper _mapper;
        private readonly GetSuppliersQueryHandler _handler;

        public GetSuppliersQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockSupplierRepo = new Mock<IGenericRepository<Supplier>>();

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<Supplier>()).Returns(_mockSupplierRepo.Object);

            _handler = new GetSuppliersQueryHandler(_mockUow.Object, _mapper);
        }

        private List<Supplier> GetSampleSuppliers()
        {
            return new List<Supplier>
            {
                new Supplier { SupplierId = 1, SupplierName = "Supplier Alpha", ContactInfo = "1111", ServiceArea = "Ha Noi", Rating = 4.5m, CollaborationStatus = "Active" },
                new Supplier { SupplierId = 2, SupplierName = "Supplier Beta", ContactInfo = "2222", ServiceArea = "Da Nang", Rating = 3.8m, CollaborationStatus = "Inactive" },
                new Supplier { SupplierId = 3, SupplierName = "Supplier Gamma", ContactInfo = "3333", ServiceArea = "Ha Noi", Rating = 5.0m, CollaborationStatus = "Active" }
            };
        }

        [Fact]
        public async Task UTCID01_Handle_NoFilters_ShouldReturnAllSuppliers()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(3);
            result.TotalCount.Should().Be(3);
        }

        [Fact]
        public async Task UTCID02_Handle_FilterByActiveStatus_ShouldReturnOnlyActiveSuppliers()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                CollaborationStatus = "Active",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(2);
            result.Items.All(s => s.CollaborationStatus == "Active").Should().BeTrue();
        }

        [Fact]
        public async Task UTCID03_Handle_SearchSupplierName_ShouldReturnMatchingSuppliers()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                Search = "beta",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.Items.First().SupplierName.Should().Be("Supplier Beta");
        }

        [Fact]
        public async Task UTCID04_Handle_SearchContactInfo_ShouldReturnMatchingSuppliers()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                Search = "3333",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.Items.First().SupplierName.Should().Be("Supplier Gamma");
        }

        [Fact]
        public async Task UTCID05_Handle_SearchServiceArea_ShouldReturnMatchingSuppliers()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                Search = "Ha Noi",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(2);
            result.Items.All(s => s.ServiceArea == "Ha Noi").Should().BeTrue();
        }

        [Fact]
        public async Task UTCID06_Handle_SearchNoMatch_ShouldReturnEmptyList()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                Search = "NonExistentKeyword",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task UTCID07_Handle_SortBySupplierNameAscending_ShouldSortCorrectly()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                SortBy = "name",
                SortDescending = false,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Select(s => s.SupplierName).Should().ContainInOrder("Supplier Alpha", "Supplier Beta", "Supplier Gamma");
        }

        [Fact]
        public async Task UTCID08_Handle_SortByRatingDescending_ShouldSortCorrectly()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                SortBy = "rating",
                SortDescending = true,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Select(s => s.Rating).Should().ContainInOrder(5.0m, 4.5m, 3.8m);
        }

        [Fact]
        public async Task UTCID09_Handle_PaginationAndPageSize_ShouldPaginateCorrectly()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                PageNumber = 2,
                PageSize = 2
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.TotalCount.Should().Be(3);
            result.PageNumber.Should().Be(2);
            result.PageSize.Should().Be(2);
        }

        [Fact]
        public async Task UTCID10_Handle_SortByStatusAscending_ShouldSortCorrectly()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                SortBy = "status",
                SortDescending = false,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Select(s => s.CollaborationStatus).Should().ContainInOrder("Active", "Active", "Inactive");
        }

        [Fact]
        public async Task UTCID11_Handle_PaginationFallback_ShouldClampInvalidPageNumberAndSize()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                PageNumber = -1, // Invalid PageNumber -> should fallback to 1
                PageSize = -5    // Invalid PageSize -> should fallback to 20
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.PageNumber.Should().Be(1);
            result.PageSize.Should().Be(20);
            result.Items.Should().HaveCount(3);
        }

        [Fact]
        public async Task UTCID12_Handle_InvalidSortByField_ShouldFallbackToCreatedAtDescending()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            // Assign different CreatedAt times to verify sort fallback
            suppliers[0].CreatedAt = DateTime.UtcNow.AddMinutes(-10);
            suppliers[1].CreatedAt = DateTime.UtcNow; // Newest
            suppliers[2].CreatedAt = DateTime.UtcNow.AddMinutes(-5);

            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                SortBy = "invalidFieldName",
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Select(s => s.SupplierId).Should().ContainInOrder(2, 3, 1);
        }

        [Fact]
        public async Task UTCID13_Handle_CombinedFilters_ShouldApplyAllFilterCriteriaCorrectly()
        {
            // Arrange
            var suppliers = GetSampleSuppliers();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.BuildMock());

            var query = new GetSuppliersQuery
            {
                CollaborationStatus = "Active",
                Search = "alpha",
                SortBy = "name",
                SortDescending = false,
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.Items.First().SupplierName.Should().Be("Supplier Alpha");
        }
    }
}
