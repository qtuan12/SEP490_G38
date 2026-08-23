namespace BPG.Domain.Constants;

public static class CollaborationStatus
{
    public const string Strategic = "Strategic";
    public const string Regular = "Regular";
    public const string Restricted = "Restricted";
    public const string Blacklisted = "Blacklisted";

    public static string GetLabel(string status)
    {
        return status switch
        {
            Strategic => "Chiến lược",
            Regular => "Thường xuyên",
            Restricted => "Hạn chế",
            Blacklisted => "Danh sách đen",
            _ => "Không xác định"
        };
    }
}
