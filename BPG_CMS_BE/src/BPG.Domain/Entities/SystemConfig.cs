namespace BPG.Domain.Entities;

public class SystemConfig : BaseEntity
{
    public string ConfigKey { get; set; } = string.Empty;
    public string ConfigValue { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
}
