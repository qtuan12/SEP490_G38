namespace BPG.Application.DTOs.Suppliers
{
    public class UpdateSupplierRequest
    {
        public string SupplierName { get; set; } = string.Empty;
        public string? ContactInfo { get; set; }
        public string? Address { get; set; }
        public string? ServiceArea { get; set; }
        public decimal? Rating { get; set; }
        public string? EvaluationNote { get; set; }
        public string CollaborationStatus { get; set; } = "Active";
    }
}
