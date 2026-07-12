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
    public class UpdateSupplierCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Supplier>> _mockSupplierRepo;
        private readonly IMapper _mapper;
        private readonly UpdateSupplierCommandHandler _handler;

        public UpdateSupplierCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockSupplierRepo = new Mock<IGenericRepository<Supplier>>();

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<Supplier>()).Returns(_mockSupplierRepo.Object);

            _handler = new UpdateSupplierCommandHandler(_mockUow.Object, _mapper);
        }

        private void SetupAnyAsync(List<Supplier> existingSuppliers)
        {
            _mockSupplierRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()))
                .Returns((Expression<Func<Supplier, bool>> predicate, CancellationToken ct) =>
                    Task.FromResult(existingSuppliers.AsQueryable().Any(predicate)));
        }

        [Fact]
        public async Task UTCID01_Handle_ValidData_ShouldUpdateSupplierSuccessfully()
        {
            // Arrange
            var existingSupplier = new Supplier
            {
                SupplierId = 1,
                SupplierName = "Nha Cung Cap A",
                ContactInfo = "0123",
                Address = "Old Address",
                ServiceArea = "Old Area",
                Rating = 4m,
                EvaluationNote = "Old Note",
                CollaborationStatus = "Active"
            };

            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(existingSupplier);

            var databaseSuppliers = new List<Supplier> { existingSupplier };
            SetupAnyAsync(databaseSuppliers);

            var command = new UpdateSupplierCommand(
                SupplierId: 1,
                SupplierName: "Nha Cung Cap A New",
                ContactInfo: "0999",
                Address: "New Address",
                ServiceArea: "New Area",
                Rating: 4.8m,
                EvaluationNote: "New Note",
                CollaborationStatus: "Suspended"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.SupplierId.Should().Be(1);
            result.SupplierName.Should().Be("Nha Cung Cap A New");
            result.ContactInfo.Should().Be("0999");
            result.Address.Should().Be("New Address");
            result.ServiceArea.Should().Be("New Area");
            result.Rating.Should().Be(4.8m);
            result.EvaluationNote.Should().Be("New Note");
            result.CollaborationStatus.Should().Be("Suspended");

            _mockSupplierRepo.Verify(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.Update(existingSupplier), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_SupplierNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Supplier?)null);

            var command = new UpdateSupplierCommand(
                SupplierId: 999,
                SupplierName: "Non Existent",
                ContactInfo: "0000",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 3m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("Supplier với ID [999] không tồn tại.");

            _mockSupplierRepo.Verify(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.Update(It.IsAny<Supplier>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_DuplicateNameWithAnotherSupplier_ShouldThrowDuplicateEntryException()
        {
            // Arrange
            var supplierToUpdate = new Supplier { SupplierId = 1, SupplierName = "Old Name" };
            var anotherSupplier = new Supplier { SupplierId = 2, SupplierName = "Nha Cung Cap B" };

            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(supplierToUpdate);

            var databaseSuppliers = new List<Supplier> { supplierToUpdate, anotherSupplier };
            SetupAnyAsync(databaseSuppliers);

            var command = new UpdateSupplierCommand(
                SupplierId: 1,
                SupplierName: "Nha Cung Cap B",
                ContactInfo: "0123",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 4m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<DuplicateEntryException>()
                .WithMessage("Tên nhà cung cấp 'Nha Cung Cap B' đã tồn tại trong hệ thống.");

            _mockSupplierRepo.Verify(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockSupplierRepo.Verify(r => r.Update(It.IsAny<Supplier>()), Times.Never);
        }

        [Fact]
        public async Task UTCID04_Handle_DuplicateNameWithAnotherSupplierDifferentCase_ShouldThrowDuplicateEntryException()
        {
            // Arrange
            var supplierToUpdate = new Supplier { SupplierId = 1, SupplierName = "Old Name" };
            var anotherSupplier = new Supplier { SupplierId = 2, SupplierName = "Nha Cung Cap B" };

            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(supplierToUpdate);

            var databaseSuppliers = new List<Supplier> { supplierToUpdate, anotherSupplier };
            SetupAnyAsync(databaseSuppliers);

            var command = new UpdateSupplierCommand(
                SupplierId: 1,
                SupplierName: "  nha cunG cap B  ",
                ContactInfo: "0123",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 4m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<DuplicateEntryException>()
                .WithMessage("Tên nhà cung cấp '  nha cunG cap B  ' đã tồn tại trong hệ thống.");
        }

        [Fact]
        public async Task UTCID05_Handle_SameNameAsBefore_ShouldUpdateSuccessfullyWithoutDuplicateException()
        {
            // Arrange
            var existingSupplier = new Supplier { SupplierId = 1, SupplierName = "Nha Cung Cap A" };

            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(existingSupplier);

            var databaseSuppliers = new List<Supplier> { existingSupplier };
            SetupAnyAsync(databaseSuppliers);

            var command = new UpdateSupplierCommand(
                SupplierId: 1,
                SupplierName: "Nha Cung Cap A",
                ContactInfo: "New Contact",
                Address: "Street",
                ServiceArea: "Area",
                Rating: 4m,
                EvaluationNote: "Note",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.SupplierName.Should().Be("Nha Cung Cap A");
            result.ContactInfo.Should().Be("New Contact");
        }

        [Fact]
        public async Task UTCID06_Handle_OptionalFieldsNull_ShouldSetNullValuesSuccessfully()
        {
            // Arrange
            var existingSupplier = new Supplier
            {
                SupplierId = 1,
                SupplierName = "Nha Cung Cap A",
                ContactInfo = "Old Contact",
                Address = "Old Address"
            };

            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(existingSupplier);

            var databaseSuppliers = new List<Supplier> { existingSupplier };
            SetupAnyAsync(databaseSuppliers);

            var command = new UpdateSupplierCommand(
                SupplierId: 1,
                SupplierName: "Nha Cung Cap A",
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
            result.ContactInfo.Should().BeNull();
            result.Address.Should().BeNull();
            result.ServiceArea.Should().BeNull();
            result.Rating.Should().BeNull();
            result.EvaluationNote.Should().BeNull();
        }

        [Fact]
        public async Task UTCID07_Handle_TrimUpdatedFields_ShouldTrimStringsSuccessfully()
        {
            // Arrange
            var existingSupplier = new Supplier { SupplierId = 1, SupplierName = "Nha Cung Cap A" };

            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
                .ReturnsAsync(existingSupplier);

            var databaseSuppliers = new List<Supplier> { existingSupplier };
            SetupAnyAsync(databaseSuppliers);

            var command = new UpdateSupplierCommand(
                SupplierId: 1,
                SupplierName: "  Nha Cung Cap A  ",
                ContactInfo: "  9999   ",
                Address: "  Address   ",
                ServiceArea: "  Area   ",
                Rating: 4m,
                EvaluationNote: "  Note   ",
                CollaborationStatus: "Active"
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.SupplierName.Should().Be("Nha Cung Cap A");
            result.ContactInfo.Should().Be("9999");
            result.Address.Should().Be("Address");
            result.ServiceArea.Should().Be("Area");
            result.EvaluationNote.Should().Be("Note");
        }

        [Fact]
        public async Task UTCID08_Handle_RatingBoundaryMin_ShouldUpdateSuccessfully()
        {
            // Arrange
            var existingSupplier = new Supplier { SupplierId = 1, SupplierName = "A" };
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(existingSupplier);
            SetupAnyAsync(new List<Supplier> { existingSupplier });

            var command = new UpdateSupplierCommand(1, "A", null, null, null, 0m, null, "Active");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Rating.Should().Be(0m);
        }

        [Fact]
        public async Task UTCID09_Handle_RatingBoundaryMax_ShouldUpdateSuccessfully()
        {
            // Arrange
            var existingSupplier = new Supplier { SupplierId = 1, SupplierName = "A" };
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(existingSupplier);
            SetupAnyAsync(new List<Supplier> { existingSupplier });

            var command = new UpdateSupplierCommand(1, "A", null, null, null, 5m, null, "Active");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Rating.Should().Be(5m);
        }

        [Fact]
        public async Task UTCID10_Handle_StatusUpdated_ShouldUpdateCollaborationStatus()
        {
            // Arrange
            var existingSupplier = new Supplier { SupplierId = 1, SupplierName = "A", CollaborationStatus = "Active" };
            _mockSupplierRepo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(existingSupplier);
            SetupAnyAsync(new List<Supplier> { existingSupplier });

            var command = new UpdateSupplierCommand(1, "A", null, null, null, 4m, null, "Suspended");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.CollaborationStatus.Should().Be("Suspended");
        }
    }
}
