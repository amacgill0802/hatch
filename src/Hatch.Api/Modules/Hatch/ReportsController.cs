using Hatch.Api.Common;
using Hatch.Api.Ef;
using Hatch.Api.Services.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// Reads of the trail the board leaves behind, rather than of the board as it
/// stands: when the work happened, not what is where.
///
/// All of the arithmetic lives in <see cref="TimelineReport"/>. This controller
/// loads the rows, asks the fold, and decorates what it answers with cards.
/// </summary>
[ApiController]
[Route("api/hatch/reports")]
[RequireRole(PersonRole.User, AcceptScope = ApiKeyScopes.Hatch)]
public class ReportsController(
    HatchContext db, IActorDirectory actors, IssueClaims claims, TimeProvider time) : ControllerBase
{
    /// <summary>The range when a caller names neither bound: the ninety days ending now.</summary>
    private static readonly TimeSpan DefaultRange = TimeSpan.FromDays(90);

    /// <summary>
    /// When the work happened: the top-level epics active in a range, and the
    /// work beneath each, as stretches in the board's active columns.
    /// </summary>
    /// <param name="from">The start of the range; ninety days before <paramref name="to"/> when absent.</param>
    /// <param name="to">The end of the range; now when absent.</param>
    /// <param name="projectId">Narrows the top-level rows to one project's; what rides beneath them is not cut.</param>
    /// <param name="createdBy">Narrows the top-level rows to one creator's.</param>
    /// <remarks>
    /// Neither query below is bounded by the range or by the project. The fold
    /// needs an issue's first move even when it falls after the range's end -
    /// that move's <c>from</c> is the column the issue was in during it - and
    /// children ride with their root whatever project they were filed in.
    /// </remarks>
    [HttpGet("timeline")]
    public async Task<ActionResult<TimelineDto>> GetTimeline(
        [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] int? projectId, [FromQuery] string? createdBy, CancellationToken ct)
    {
        var now = time.GetUtcNow();

        if (RangeBounds.Resolve(from, to, now, DefaultRange, out var start, out var end) is { } refusal)
            return BadRequest(refusal);

        if (projectId is { } wanted && !await db.Projects.AnyAsync(p => p.Id == wanted, ct))
            return BadRequest($"there is no project {wanted}");

        var statuses = await db.Statuses.AsNoTracking()
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Id)
            .ToListAsync(ct);

        var rows = (await db.Issues.AsNoTracking()
                .Select(i => new
                {
                    i.Id,
                    i.ParentId,
                    i.ProjectId,
                    ProjectKey = i.Project!.Key,
                    i.Number,
                    i.Type,
                    i.StatusId,
                    i.Rank,
                    i.CreatedAt,
                    i.CreatedBy,
                })
                .ToListAsync(ct))
            .Select(i => new TimelineReport.Row(
                i.Id, i.ParentId, i.ProjectId, i.ProjectKey, i.Number, i.Type,
                i.StatusId, i.Rank, i.CreatedAt, i.CreatedBy))
            .ToList();

        var events = await db.IssueEvents.AsNoTracking()
            .Where(e => e.Kind == EfHatchIssueEvent.StatusChanged)
            .OrderBy(e => e.IssueId)
            .ThenBy(e => e.At)
            .ThenBy(e => e.Id)
            .Select(e => new { e.IssueId, e.Id, e.At, e.Payload })
            .ToListAsync(ct);

        var changes = events
            .Select(e => TimelineReport.ParseChange(e.IssueId, e.Id, e.At, e.Payload))
            .OfType<TimelineReport.Change>()
            .ToList();

        var result = TimelineReport.Fold(rows, changes, statuses, start, end, projectId, createdBy);

        // Cards for exactly the issues in the answer, and none of the rest of
        // the tracker.
        var ids = new HashSet<long>();
        foreach (var epic in result.Epics) CollectIds(epic, ids);
        if (result.Other is { } loose) CollectIds(loose, ids);

        var cards = new Dictionary<long, IssueCardDto>();

        if (ids.Count > 0)
        {
            var priorities = await PriorityTree.ForAsync(db, ct);

            var issues = await db.Issues.AsNoTracking()
                .Where(i => ids.Contains(i.Id))
                .Select(i => new
                {
                    i.Id,
                    ProjectKey = i.Project!.Key,
                    i.Number,
                    i.Type,
                    i.Title,
                    i.StatusId,
                    i.Rank,
                    ParentProjectKey = i.Parent == null ? null : i.Parent.Project!.Key,
                    ParentNumber = i.Parent == null ? (int?)null : i.Parent.Number,
                    i.ReadyAt,
                    i.ReadyAtHasTime,
                    i.DueAt,
                    i.DueAtHasTime,
                    i.AssigneePersonId,
                    i.AssigneeApiKeyId,
                    i.Priority,
                    i.PreApproval,
                    i.StalledAt,
                    i.StalledWhy,
                    i.Held,
                    i.PullRequestUrl,
                    i.ClosedAt,
                    Claim = new ClaimSnapshot(
                        i.ClaimToken, i.ClaimedBy, i.ClaimRunner,
                        i.ClaimedAt, i.ClaimHeartbeatAt, i.ClaimChatter, i.ClaimChatterAt),
                })
                .ToListAsync(ct);

            // Resolved up front rather than inside the walk below, which is
            // synchronous. The directory is memoized either way.
            var assignees = new Dictionary<long, AssigneeDto?>();
            foreach (var i in issues)
                assignees[i.Id] = await IssueProjection.ToAssigneeAsync(actors, i.AssigneePersonId, i.AssigneeApiKeyId, ct);

            foreach (var i in issues)
            {
                var (effectivePreApproval, effectivePreApprovalFrom) = priorities.EffectivePreApproval(i.Id);
                var (onePr, onePrOwn, onePrFrom) = priorities.EffectiveOnePr(i.Id);

                cards[i.Id] = new IssueCardDto(
                    IssueKey.Format(i.ProjectKey, i.Number),
                    i.ProjectKey,
                    i.Type,
                    i.Title,
                    i.StatusId,
                    i.Rank,
                    i.ParentNumber is { } n ? IssueKey.Format(i.ParentProjectKey!, n) : null,
                    IssueMoment.Format(i.ReadyAt, i.ReadyAtHasTime),
                    IssueMoment.Format(i.DueAt, i.DueAtHasTime),
                    Assignee: assignees[i.Id],
                    Claim: claims.Project(i.Claim, now),
                    Expedited: i.Priority >= PriorityLevels.Expedited,
                    Express: effectivePreApproval >= PreApprovalLevels.Express,
                    Priority: PriorityLevels.Name(i.Priority),
                    PreApproval: PreApprovalLevels.Name(effectivePreApproval),
                    PreApprovalOwn: PreApprovalLevels.Name(i.PreApproval),
                    PreApprovalFrom: effectivePreApprovalFrom,
                    StalledAt: i.StalledAt,
                    StalledWhy: i.StalledWhy,
                    Held: i.Held,
                    PullRequestUrl: i.PullRequestUrl,
                    OnePr: onePr,
                    OnePrOwn: onePrOwn,
                    OnePrFrom: onePrFrom,
                    ClosedAt: i.ClosedAt);
            }
        }

        return new TimelineDto(
            start,
            end,
            result.Epics.Select(Entry).ToList(),
            result.Other is { } other ? Entry(other) : null,
            result.Creators,
            result.Unresolved);

        TimelineEntryDto Entry(TimelineReport.Node node) => new(
            node.IssueId is { } id ? cards[id] : OtherCard,
            node.CreatedBy,
            node.IsLeaf,
            node.Segments.Select(s => new TimelineSegmentDto(s.StatusId, s.From, s.To)).ToList(),
            node.Children.Select(Entry).ToList());
    }

    /// <summary>The card the loose work is drawn under: no issue, so nothing on it is real.</summary>
    private static readonly IssueCardDto OtherCard = new("other", "", "epic", "Other", 0, 0, null, null, null);

    private static void CollectIds(TimelineReport.Node node, HashSet<long> ids)
    {
        if (node.IssueId is { } id) ids.Add(id);
        foreach (var child in node.Children) CollectIds(child, ids);
    }
}
