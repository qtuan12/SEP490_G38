using System.Collections.Generic;

namespace BPG.Application.DTOs.Inventory
{
    public class MaterialPhaseUsageDto
    {
        public long PhaseId { get; set; }
        public string PhaseName { get; set; } = string.Empty;
        public decimal BoqQuantity { get; set; }
        public decimal UsedQuantity { get; set; }
    }

    public class CurrentInventoryDto
    {
        public long InventoryId { get; set; }
        public long ProjectId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal ReservedQuantity { get; set; }
        public decimal AvailableQuantity => Quantity - ReservedQuantity;
        public decimal SafetyThreshold { get; set; }
        public decimal BoqQuantity { get; set; }
        public decimal UsedQuantity { get; set; }
        public List<MaterialPhaseUsageDto> PhaseUsages { get; set; } = new List<MaterialPhaseUsageDto>();
    }
}
