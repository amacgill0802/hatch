using Microsoft.EntityFrameworkCore;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// Whether this issue's most recent <see cref="EfHatchIssueEvent.StatusChanged"/>
/// carried a failing verdict - what <see cref="WorkController.ResolveAsync"/>
/// asks before handing a dispatch <see cref="WorkDto.LastCheckFindings"/>. A
/// positive filter on the newest <c>status_changed</c>, not a list of kinds to
/// skip past it: everything a check's own fail is followed by - <c>claim_taken</c>,
/// <c>claim_released</c> (always there, the check session's own release),
/// <c>claim_lapsed</c>, <c>claim_cleared</c>, <c>claim_preempted</c>, <c>stalled</c>,
/// <c>resumed</c>, <c>commented</c>, <c>verdict_recorded</c> - is answered by this
/// one filter rather than by naming each in turn.
/// </summary>
public static class LastVerdict
{
    /// <summary>
    /// The newest <see cref="EfHatchIssueEvent.StatusChanged"/> event, read back
    /// for a failing <c>verdict</c> - false where there is none, or the newest
    /// one did not fail.
    /// </summary>
    public static bool WasFail(IEnumerable<(string Kind, string? Payload)> eventsNewestFirst)
    {
        foreach (var e in eventsNewestFirst)
        {
            if (e.Kind != EfHatchIssueEvent.StatusChanged) continue;

            return IssueEventPayload.Parse(e.Payload)?.TryGetProperty("verdict", out var verdict) == true
                && verdict.GetString() == CheckVerdicts.Fail;
        }

        return false;
    }

    /// <summary>The single-issue query <see cref="WasFail"/> is run against, for a named dispatch.</summary>
    public static async Task<bool> ForIssueAsync(HatchContext db, long issueId, CancellationToken ct)
    {
        var events = await db.IssueEvents.AsNoTracking()
            .Where(e => e.IssueId == issueId)
            .OrderByDescending(e => e.At).ThenByDescending(e => e.Id)
            .Select(e => new { e.Kind, e.Payload })
            .ToListAsync(ct);

        return WasFail(events.Select(e => (e.Kind, e.Payload)));
    }
}
