using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.DTOs.Suppliers;
using BPG.Application.Features.Suppliers.Handlers;
using BPG.Application.Features.Suppliers.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.Suppliers
{
    public class GetSupplierByIdQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Supplier>> _mockSupplierRepo;
        private readonly IMapper _mapper;
        private readonly GetSupplierByIdQueryHandler _handler;

        public GetSupplierByIdQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockSupplierRepo = new Mock<IGenericRepository<Supplier>>();

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<Supplier>()).Returns(_mockSupplierRepo.Object);

            _handler = new GetSupplierByIdQueryHandler(_mockUow.Object, _mapper);
        }

        [Fact]
        public async Task UTCID01_Handle_ExistingSupplier_ShouldReturnSupplierDto()
        {
            // Arrange
            var supplier = new Supplier
            {
                SupplierId = 1,
                SupplierName = "Nha Cung Cap A",
                ContactInfo = "0123",
                Address = "Address A",
                ServiceArea = "Area A",
                Rating = 4.5m,
                EvaluationNote = "Good",
                CollaborationStatus = "Active"
            };

            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(supplier);

            var query = new GetSupplierByIdQuery(1);

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.SupplierId.Should().Be(1);
            result.SupplierName.Should().Be("Nha Cung Cap A");
            result.ContactInfo.Should().Be("0123");
            result.Address.Should().Be("Address A");
            result.ServiceArea.Should().Be("Area A");
            result.Rating.Should().Be(4.5m);
            result.EvaluationNote.Should().Be("Good");
            result.CollaborationStatus.Should().Be("Active");
        }

        [Fact]
        public async Task UTCID02_Handle_SupplierNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Supplier?)null);

            var query = new GetSupplierByIdQuery(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("Supplier với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_SoftDeletedSupplier_ShouldThrowNotFoundException()
        {
            // Arrange
            // Soft-deleted supplier returns null under global query filters
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(5, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Supplier?)null);

            var query = new GetSupplierByIdQuery(5);

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("Supplier với ID [5] không tồn tại.");
        }
    }
}
