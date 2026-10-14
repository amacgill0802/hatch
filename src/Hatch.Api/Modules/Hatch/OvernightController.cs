using Hatch.Api.Common;
using Hatch.Api.Ef;
using Hatch.Api.Services.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// What landed in the newest night: wires the database to
/// <see cref="Overnight.NewestNight"/>, which does all of the grouping,
/// gap-splitting and ordering.
/// </summary>
/// <remarks>
/// No <c>ICallerIdentity</c> and no <c>NotAKey</c> - the same reason
/// <see cref="WorkLogController"/> gives: this is a read, and reads in this
/// module are open to a person and to a <c>hatch</c>-scoped key alike.
/// </remarks>
[ApiController]
[Route("api/hatch/overnight")]
[RequireRole(PersonRole.User, AcceptScope = ApiKeyScopes.Hatch)]
public class OvernightController(HatchContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<OvernightDto>> GetOvernight(CancellationToken ct)
    {
        var terminal = await db.Issues.AsNoTracking()
            .Where(i => i.Status!.IsTerminal)
            .Select(i => new { i.Id, ProjectKey = i.Project!.Key, i.Number, i.Type, i.Title })
            .ToListAsync(ct);

        if (terminal.Count == 0) return Overnight.NewestNight([]);

        var terminalIds = terminal.Select(i => i.Id).ToHashSet();

        // One query over the marked issues' status_changed events, materialized,
        // then grouped in memory for the newest `At` per issue - the same shape
        // SendBackStreak.CountsAsync and LetGo.CountsAsync already use for "one
        // round trip, many issues, grouped", and not a server-side GroupBy+Max:
        // ChannelLatestValues.cs already flags GroupBy's Npgsql translation as
        // uncertain, which is why that file avoids GroupBy entirely, and no
        // other grouped-aggregate call in this codebase asks the database to do
        // the grouping either.
        var events = await db.IssueEvents.AsNoTracking()
            .Where(e => e.Kind == EfHatchIssueEvent.StatusChanged && terminalIds.Contains(e.IssueId))
            .Select(e => new { e.IssueId, e.At })
            .ToListAsync(ct);

        var landedAt = events
            .GroupBy(e => e.IssueId)
            .ToDictionary(g => g.Key, g => g.Max(e => e.At));

        var tree = await Rollup.LoadAsync(db, ct);

        var landings = terminal
            // Filing into a terminal column is already refused
            // (IssuesController.CreateIssueAsync), so every terminal issue has
            // passed through at least one status_changed - this should never
            // drop a row, but a current status with no matching event is
            // excluded rather than crashing on a missing key.
            .Where(i => landedAt.ContainsKey(i.Id))
            .Select(i => new Overnight.Landing(
                i.Id, IssueKey.Format(i.ProjectKey, i.Number), i.Type, i.Title, i.ProjectKey,
                landedAt[i.Id], tree.DescendantCount(i.Id)))
            .ToList();

        return Overnight.NewestNight(landings);
    }
}
