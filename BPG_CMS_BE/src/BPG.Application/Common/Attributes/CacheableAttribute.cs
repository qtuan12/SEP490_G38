namespace BPG.Application.Common.Attributes;

[AttributeUsage(AttributeTargets.Class)]
public sealed class CacheableAttribute : Attribute
{
    public int DurationSeconds { get; set; } = 600;
}
