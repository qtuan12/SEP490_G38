namespace BPG.Api.Configuration;

public sealed class RateLimitOptions
{
    public string RejectionMessage { get; set; } = "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.";

    public Dictionary<string, RateLimitPolicyOptions> Policies { get; set; } = new();

    public RateLimitPolicyOptions GetPolicy(string policyName)
    {
        return Policies.TryGetValue(policyName, out var policy)
            ? policy
            : new RateLimitPolicyOptions();
    }
}

public sealed class RateLimitPolicyOptions
{
    public int PermitLimit { get; set; } = 100;

    public int WindowSeconds { get; set; } = 60;

    public int QueueLimit { get; set; }
}
