namespace BPG.Application.DTOs.Suppliers
{
    public class ImportSuppliersResultDto
    {
        public int SuccessCount { get; set; }
        public int SkippedCount { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<SupplierDto> ImportedSuppliers { get; set; } = new();
    }
}
