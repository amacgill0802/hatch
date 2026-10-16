using System.Text.Json;
using Hatch.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// How many times in a row a check playbook has failed this issue, newest
/// first, uncounted by <see cref="SendBackStreak"/> because a verdict carries
/// no <c>sendback</c> flag at all - see <see cref="WorkController.VerdictWork"/>
/// for what the count is for.
/// </summary>
public static class VerdictStreak
{
    /// <summary>
    /// Walks the event trail newest first, counting consecutive
    /// <c>status_changed</c> fails for <paramref name="playbookId"/>. Unlike
    /// <see cref="SendBackStreak.Count"/>, an <c>answered</c> event must stop
    /// the walk even though it is a different <see cref="EfHatchIssueEvent.Kind"/>
    /// entirely - it is checked before the <c>status_changed</c> filter rather
    /// than falling out of it by accident. A <c>status_changed</c> with no
    /// <c>verdict</c> at all is the ordinary advance into the check column
    /// between one fail and the next, and is skipped without counting or
    /// breaking; a verdict for a different playbook is a real interruption
    /// and breaks.
    /// </summary>
    public static int Count(IEnumerable<(string Kind, string? Payload)> eventsNewestFirst, int playbookId)
    {
        var streak = 0;
        foreach (var e in eventsNewestFirst)
        {
            if (e.Kind == EfHatchIssueEvent.Answered) break;
            if (e.Kind != EfHatchIssueEvent.StatusChanged) continue;

            if (IsFail(e.Payload, playbookId)) { streak++; continue; }
            if (IsPass(e.Payload, playbookId)) break;
            if (HasNoVerdict(e.Payload)) continue;

            break; // a real advance, or a verdict for a different playbook - either way, not this streak's business
        }
        return streak;
    }

    /// <summary>The single-issue query <see cref="Count"/> is run against.</summary>
    public static async Task<int> ForIssueAsync(HatchContext db, long issueId, int playbookId, CancellationToken ct)
    {
        var events = await db.IssueEvents.AsNoTracking()
            .Where(e => e.IssueId == issueId)
            .OrderByDescending(e => e.At).ThenByDescending(e => e.Id)
            .Select(e => new { e.Kind, e.Payload })
            .ToListAsync(ct);

        return Count(events.Select(e => (e.Kind, e.Payload)), playbookId);
    }

    /// <summary>The same count for however many issues are being judged at once - one query, grouped.</summary>
    public static async Task<Dictionary<long, int>> CountsAsync(
        HatchContext db, IReadOnlyList<long> issueIds, int playbookId, CancellationToken ct)
    {
        var events = await db.IssueEvents.AsNoTracking()
            .Where(e => issueIds.Contains(e.IssueId))
            .OrderByDescending(e => e.At).ThenByDescending(e => e.Id)
            .Select(e => new { e.IssueId, e.Kind, e.Payload })
            .ToListAsync(ct);

        return events
            .GroupBy(e => e.IssueId)
            .ToDictionary(g => g.Key, g => Count(g.Select(e => (e.Kind, e.Payload)), playbookId));
    }

    private static bool IsFail(string? payload, int playbookId) => HasVerdict(payload, playbookId, CheckVerdicts.Fail);

    private static bool IsPass(string? payload, int playbookId) => HasVerdict(payload, playbookId, CheckVerdicts.Pass);

    private static bool HasVerdict(string? payload, int playbookId, string verdict)
    {
        if (string.IsNullOrWhiteSpace(payload)) return false;

        try
        {
            using var doc = JsonDocument.Parse(payload);
            return doc.RootElement.TryGetProperty("verdict", out var v) && v.ValueKind == JsonValueKind.String
                && v.GetString() == verdict
                && doc.RootElement.TryGetProperty("playbookId", out var p) && p.ValueKind == JsonValueKind.Number
                && p.GetInt32() == playbookId;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool HasNoVerdict(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return true;

        try
        {
            using var doc = JsonDocument.Parse(payload);
            return !doc.RootElement.TryGetProperty("verdict", out _);
        }
        catch (JsonException)
        {
            return true;
        }
    }
}
