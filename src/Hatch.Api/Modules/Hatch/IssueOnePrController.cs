using System.Text.Json;
using Hatch.Api.Common;
using Hatch.Api.Ef;
using Hatch.Api.Services.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// Whether a story's tasks share the story's branch and one pull request -
/// the story's own say, over its project's default. See
/// <see cref="EfHatchIssue.OnePullRequest"/>.
/// </summary>
/// <remarks>
/// <para>Its own controller, and open to a key where its neighbours
/// (<see cref="IssueExpediteController"/>, <see cref="IssuePreApprovalController"/>)
/// are not. Priority and pre-approval decide which tickets the loop reaches for
/// and which gates it may pass unattended, so a key that could set them could
/// advance its own ticket. This decides only how a story is branched, which is
/// the author of the story's call and gives a key nothing it could not already
/// do - it is the project's default, which changes how every story is worked,
/// that is an owner's (<see cref="ProjectsController.PutLanding"/>).</para>
///
/// <para>Locked once any work under the story has started. A task begun on its
/// own branch cannot be moved onto the story's, and a task begun on the story's
/// cannot be given a pull request of its own, so changing the setting under
/// either would leave work that no longer agrees with the story it is part of.
/// "Started" is a descendant standing in the implementation column or any
/// column to its right, a terminal one included; a shelved descendant has not
/// started. Setting the value the story already holds is never refused.</para>
/// </remarks>
[ApiController]
[Route("api/hatch/issues")]
public class IssueOnePrController(
    HatchContext db, IActorDirectory actors, IssueClaims claims, ICallerIdentity caller,
    TimeProvider time) : ControllerBase
{
    public const string On = "on";
    public const string Off = "off";
    public const string Inherit = "inherit";

    /// <summary>
    /// Set the override by name - <c>on</c>, <c>off</c> or <c>inherit</c> (the
    /// project's default) - see <see cref="OnePrRequest"/>. Stories only.
    /// </summary>
    /// <remarks>
    /// Setting the value the story already holds writes nothing and does not
    /// move <c>UpdatedAt</c>, the same as every other edit in Hatch - so a
    /// control pressed twice leaves one trail entry and not two.
    /// </remarks>
    [HttpPut("{key}/one-pr")]
    [RequireRole(PersonRole.User, AcceptScope = ApiKeyScopes.Hatch)]
    public async Task<ActionResult<IssueDto>> PutIssueOnePr(string key, OnePrRequest request, CancellationToken ct)
    {
        if (!TryParse(request.Value, out var value))
            return BadRequest($"\"{request.Value}\" is not a one-PR setting - {On}, {Off} or {Inherit}");

        if (!IssueKey.TryParse(key, out var projectKey, out var number)) return NotFound();

        var issue = await db.Issues.Include(i => i.Project).WithKey(projectKey, number).FirstOrDefaultAsync(ct);
        if (issue is null) return NotFound();

        if (issue.Type != "story")
            return BadRequest($"only a story shares one pull request across its tasks - {key} is a {issue.Type}");

        if (value != issue.OnePullRequest)
        {
            if (await StartedAsync(issue, ct) is { } started)
                return Conflict(
                    $"{key} has work under it that has already started ({started}), so whether its tasks share one " +
                    "pull request can no longer be changed - a task begun on one branch cannot be moved onto the other");

            var now = time.GetUtcNow();

            issue.Events.Add(new EfHatchIssueEvent
            {
                Actor = await caller.ActorNameAsync(ct),
                Kind = EfHatchIssueEvent.OnePrChanged,
                Payload = JsonSerializer.Serialize(new { from = Name(issue.OnePullRequest), to = Name(value) }),
                At = now,
            });

            issue.OnePullRequest = value;
            issue.UpdatedAt = now;
            await db.SaveChangesAsync(ct);
        }

        return await IssueProjection.ToDtoAsync(db, actors, issue, claims, time.GetUtcNow(), ct);
    }

    /// <summary>
    /// The first descendant of the story that has started, as <c>AER-6 is in
    /// "In Progress"</c>, or null while none has. Nothing has started on a board
    /// with no implementation column to start in.
    /// </summary>
    private async Task<string?> StartedAsync(EfHatchIssue story, CancellationToken ct)
    {
        var statuses = await db.Statuses.AsNoTracking().OrderBy(s => s.SortOrder).ThenBy(s => s.Id).ToListAsync(ct);
        if (Columns.Implementation(statuses) is not { } implementation) return null;

        var board = Columns.Board(statuses);
        var from = board.FindIndex(s => s.Id == implementation.Id);

        var ids = await Rollup.DescendantIdsAsync(db, story.Id, ct);
        if (ids.Count == 0) return null;

        var rows = await db.Issues.AsNoTracking()
            .Where(i => ids.Contains(i.Id))
            .OrderBy(i => i.Rank).ThenBy(i => i.Id)
            .Select(i => new { ProjectKey = i.Project!.Key, i.Number, i.StatusId })
            .ToListAsync(ct);

        foreach (var row in rows)
        {
            var at = board.FindIndex(s => s.Id == row.StatusId);
            if (at >= from && at >= 0) return $"{IssueKey.Format(row.ProjectKey, row.Number)} is in \"{board[at].Name}\"";
        }

        return null;
    }

    private static bool TryParse(string? text, out bool? value)
    {
        value = null;
        switch (text?.Trim().ToLowerInvariant())
        {
            case On: value = true; return true;
            case Off: value = false; return true;
            case Inherit: return true;
            default: return false;
        }
    }

    private static string Name(bool? value) => value switch { true => On, false => Off, null => Inherit };
}
