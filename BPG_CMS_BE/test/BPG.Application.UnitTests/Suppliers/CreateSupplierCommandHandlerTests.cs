using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.DTOs.Suppliers;
using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.Features.Suppliers.Handlers;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.Suppliers
{
    public class CreateSupplierCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Supplier>> _mockSupplierRepo;
        private readonly IMapper _mapper;
        private readonly CreateSupplierCommandHandler _handler;

        public CreateSupplierCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockSupplierRepo = new Mock<IGenericRepository<Supplier>>();

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<Supplier>()).Returns(_mockSupplierRepo.Object);

            _handler = new CreateSupplierCommandHandler(_mockUow.Object, _mapper);
        }

        private void SetupAnyAsync(List<Supplier> existingSuppliers)
        {
            _mockSupplierRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()))
                .Returns((Expression<Func<Supplier, bool>> predicate, CancellationToken ct) =>
                    Task.FromResult(existingSuppliers.AsQueryable().Any(predicate)));
        }

        [Fact]
        public async Task UTCID01_Handle_ValidData_ShouldCreateSupplierSuccessfully()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "Nha Cung Cap A",
                ContactInfo: "0123456789",
                Address: "123 Street",
                ServiceArea: "Ha Noi",
                Rating: 4.5m,
                EvaluationNote: "Good supplier",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.SupplierName.Should().Be("Nha Cung Cap A");
            result.ContactInfo.Should().Be("0123456789");
            result.Address.Should().Be("123 Street");
            result.ServiceArea.Should().Be("Ha Noi");
            result.Rating.Should().Be(4.5m);
            result.EvaluationNote.Should().Be("Good supplier");
            result.CollaborationStatus.Should().Be("Active");

            _mockSupplierRepo.Verify(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.AddAsync(It.Is<Supplier>(s => s.SupplierName == "Nha Cung Cap A"), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_DuplicateNameExactMatch_ShouldThrowDuplicateEntryException()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>
            {
                new Supplier { SupplierName = "Nha Cung Cap A", CollaborationStatus = "Active" }
            };
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "Nha Cung Cap A",
                ContactInfo: "0123456789",
                Address: "123 Street",
                ServiceArea: "Ha Noi",
                Rating: 4.5m,
                EvaluationNote: "Good",
                CollaborationStatus: "Active"
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<DuplicateEntryException>()
                .WithMessage("Tên nhà cung cấp 'Nha Cung Cap A' đã tồn tại trong hệ thống.");

            _mockSupplierRepo.Verify(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.AddAsync(It.IsAny<Supplier>(), It.IsAny<CancellationToken>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_DuplicateNameDifferentCaseAndSpaces_ShouldThrowDuplicateEntryException()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>
            {
                new Supplier { SupplierName = "Nha Cung Cap A", CollaborationStatus = "Active" }
            };
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "  nha cunG cap A   ",
                ContactInfo: "0123456789",
                Address: "123 Street",
                ServiceArea: "Ha Noi",
                Rating: 4.5m,
                EvaluationNote: "Good",
                CollaborationStatus: "Active"
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<DuplicateEntryException>()
                .WithMessage("Tên nhà cung cấp '  nha cunG cap A   ' đã tồn tại trong hệ thống.");
        }

        [Fact]
        public async Task UTCID04_Handle_OptionalFieldsNull_ShouldCreateSupplierWithNullOptionalFields()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "Nha Cung Cap B",
                ContactInfo: null,
                Address: null,
                ServiceArea: null,
                Rating: null,
                EvaluationNote: null,
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.SupplierName.Should().Be("Nha Cung Cap B");
            result.ContactInfo.Should().BeNull();
            result.Address.Should().BeNull();
            result.ServiceArea.Should().BeNull();
            result.Rating.Should().BeNull();
            result.EvaluationNote.Should().BeNull();

            _mockSupplierRepo.Verify(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.AddAsync(It.IsAny<Supplier>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID05_Handle_TrailingLeadingSpaces_ShouldTrimStrings()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "  Trimmed Name   ",
                ContactInfo: "  12345   ",
                Address: "  456 Road   ",
                ServiceArea: "  Da Nang   ",
                Rating: 3.0m,
                EvaluationNote: "  Note   ",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.SupplierName.Should().Be("Trimmed Name");
            result.ContactInfo.Should().Be("12345");
            result.Address.Should().Be("456 Road");
            result.ServiceArea.Should().Be("Da Nang");
            result.EvaluationNote.Should().Be("Note");
        }

        [Fact]
        public async Task UTCID06_Handle_RatingBoundaryMin_ShouldSaveSupplierWithRatingOne()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "Nha Cung Cap Min Rating",
                ContactInfo: "0123",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 1m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Rating.Should().Be(1m);
        }

        [Fact]
        public async Task UTCID07_Handle_RatingBoundaryMax_ShouldSaveSupplierWithRatingFive()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "Nha Cung Cap Max Rating",
                ContactInfo: "0123",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 5m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Rating.Should().Be(5m);
        }

        [Fact]
        public async Task UTCID08_Handle_CollaborationStatusActive_ShouldSaveActiveStatus()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "Nha Cung Cap Active",
                ContactInfo: "0123",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 4m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.CollaborationStatus.Should().Be("Active");
        }

        [Fact]
        public async Task UTCID09_Handle_CollaborationStatusInactive_ShouldSaveInactiveStatus()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "Nha Cung Cap Inactive",
                ContactInfo: "0123",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 4m,
                EvaluationNote: "Note",
                CollaborationStatus: "Inactive"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.CollaborationStatus.Should().Be("Inactive");
        }

        [Fact]
        public async Task UTCID10_Handle_SupplierNameOneCharacter_ShouldSaveSuccessfully()
        {
            // Arrange
            var existingSuppliers = new List<Supplier>();
            SetupAnyAsync(existingSuppliers);

            var command = new CreateSupplierCommand(
                SupplierName: "X",
                ContactInfo: "0123",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 4m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.SupplierName.Should().Be("X");
        }
    }
}
