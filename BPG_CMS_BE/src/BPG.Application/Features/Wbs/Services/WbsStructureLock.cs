namespace BPG.Application.Features.Wbs.Services;

public static class WbsStructureLock
{
    public static FormattableString AcquireProject(long projectId)
        => Acquire($"Project_WbsStructure_Lock_{projectId}");

    public static FormattableString AcquirePhase(long phaseId)
        => Acquire($"Phase_WbsStructure_Lock_{phaseId}");

    private static FormattableString Acquire(string resource)
        => $"""
            DECLARE @lockResult int;
            EXEC @lockResult = sys.sp_getapplock
                @Resource = {resource},
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction';
            IF @lockResult < 0
                THROW 51000, 'Could not acquire WBS structure lock.', 1;
            """;
}
