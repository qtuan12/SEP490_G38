using System;

namespace BPG.Application.DTOs.Inventory
{
    public class InventoryTransactionDto
    {
        public long TransactionId { get; set; }
        public long ProjectId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public byte TransactionType { get; set; }
        public long ReferenceId { get; set; }
        public decimal QuantityChange { get; set; }
        public decimal BalanceAfter { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public long? CreatedBy { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
