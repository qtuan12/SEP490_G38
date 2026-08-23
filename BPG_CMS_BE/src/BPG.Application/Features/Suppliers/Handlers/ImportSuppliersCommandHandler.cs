using AutoMapper;
using BPG.Application.DTOs.Suppliers;
using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using ClosedXML.Excel;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Suppliers.Handlers
{
    public class ImportSuppliersCommandHandler : IRequestHandler<ImportSuppliersCommand, ImportSuppliersResultDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public ImportSuppliersCommandHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<ImportSuppliersResultDto> Handle(ImportSuppliersCommand request, CancellationToken cancellationToken)
        {
            // Lấy toàn bộ tên NCC hiện tại để kiểm tra trùng nhanh O(1)
            var existingNames = await _uow.Repository<Supplier>().Query()
                .Select(s => s.SupplierName.ToLower().Trim())
                .ToListAsync(cancellationToken);

            var nameSet = new HashSet<string>(existingNames);
            var newSuppliers = new List<Supplier>();
            var result = new ImportSuppliersResultDto();

            using var stream = new MemoryStream();
            await request.File.CopyToAsync(stream, cancellationToken);
            stream.Position = 0;

            using var workbook = new XLWorkbook(stream);
            var worksheet = workbook.Worksheets.FirstOrDefault()
                ?? throw new InvalidOperationException("File Excel không có worksheet nào.");

            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;

            // Dòng 1 là Header (STT | Tên NCC | Liên hệ | Địa chỉ | Khu vực)
            for (int row = 2; row <= lastRow; row++)
            {
                var supplierName = worksheet.Cell(row, 2).GetString().Trim();

                if (string.IsNullOrWhiteSpace(supplierName))
                {
                    result.Errors.Add($"Dòng {row}: Tên nhà cung cấp không được để trống.");
                    continue;
                }

                if (nameSet.Contains(supplierName.ToLower()))
                {
                    result.SkippedCount++;
                    result.Errors.Add($"Dòng {row}: '{supplierName}' đã tồn tại, bỏ qua.");
                    continue;
                }

                newSuppliers.Add(new Supplier
                {
                    SupplierName = supplierName,
                    ContactInfo = worksheet.Cell(row, 3).GetString().Trim().NullIfEmpty(),
                    Address = worksheet.Cell(row, 4).GetString().Trim().NullIfEmpty(),
                    ServiceArea = worksheet.Cell(row, 5).GetString().Trim().NullIfEmpty(),
                    CollaborationStatus = CollaborationStatus.Regular
                });

                nameSet.Add(supplierName.ToLower());
            }

            if (newSuppliers.Count > 0)
            {
                await _uow.Repository<Supplier>().AddRangeAsync(newSuppliers, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);
                result.SuccessCount = newSuppliers.Count;
                result.ImportedSuppliers = _mapper.Map<List<SupplierDto>>(newSuppliers);
            }

            return result;
        }
    }

    internal static class StringImportExtensions
    {
        internal static string? NullIfEmpty(this string value)
            => string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
