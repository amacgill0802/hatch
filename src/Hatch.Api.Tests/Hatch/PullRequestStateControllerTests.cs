using System.Text.Json;
using Hatch.Api.Common;
using Hatch.Api.Ef;
using Hatch.Api.Modules.Hatch;
using Hatch.Api.Services.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// What a runner may write about the forge's view of a recorded pull request,
/// and the rule it is kept by: a change is an event, and a repeat is not news.
/// </summary>
public class PullRequestStateControllerTests
{
    private const string Url = "https://forge.example/owner/repo/pull/7";
    private const string Sha = "1111111111111111111111111111111111111111";
    private const string OtherSha = "2222222222222222222222222222222222222222";

    // ---- The first read ----

    [Fact]
    public async Task AFirstWrite_KeepsTheThreeAndWritesOneEvent()
    {
        var h = await NewAsync();
        var issue = await h.FileWithPullRequestAsync();

        Assert.IsType<NoContentResult>(await h.PutAsync(issue, Request()));

        var row = h.Db.Issues.Single();
        Assert.Equal(MergeStates.Clean, row.PullRequestMergeState);
        Assert.Equal(ReviewDecisions.Approved, row.PullRequestReviewDecision);
        Assert.Equal(Sha, row.PullRequestHeadSha);
        Assert.Equal(Now, row.PullRequestReadAt);

        var e = Assert.Single(await h.EventsAsync(issue.Key));
        Assert.Equal("Nathan", e.Actor);
        var payload = e.Payload!.Value;
        Assert.Equal(JsonValueKind.Null, payload.GetProperty("from").ValueKind);
        var to = payload.GetProperty("to");
        Assert.Equal(MergeStates.Clean, to.GetProperty("mergeState").GetString());
        Assert.Equal(ReviewDecisions.Approved, to.GetProperty("reviewDecision").GetString());
        Assert.Equal(Sha, to.GetProperty("headSha").GetString());
    }

    // ---- A repeat ----

    [Fact]
    public async Task ARepeat_WritesNoEventAndLeavesUpdatedAtAlone_ButRefreshesTheReadTime()
    {
        var h = await NewAsync();
        var issue = await h.FileWithPullRequestAsync();
        await h.PutAsync(issue, Request());
        var updated = h.Db.Issues.Single().UpdatedAt;

        h.Time.Advance(TimeSpan.FromMinutes(5));
        Assert.IsType<NoContentResult>(await h.PutAsync(issue, Request()));

        var row = h.Db.Issues.Single();
        Assert.Single(await h.EventsAsync(issue.Key));
        Assert.Equal(updated, row.UpdatedAt);
        Assert.Equal(Now.AddMinutes(5), row.PullRequestReadAt);
    }

    // ---- Each of the three, alone ----

    [Fact]
    public async Task AChangedMergeState_WritesOneEvent()
    {
        var h = await NewAsync();
        var issue = await h.FileWithPullRequestAsync();
        await h.PutAsync(issue, Request());

        h.Time.Advance(TimeSpan.FromMinutes(1));
        await h.PutAsync(issue, Request() with { MergeState = MergeStates.Behind });

        var payload = (await h.EventsAsync(issue.Key)).Last().Payload!.Value;
        AssertSide(payload.GetProperty("from"), MergeStates.Clean, ReviewDecisions.Approved, Sha);
        AssertSide(payload.GetProperty("to"), MergeStates.Behind, ReviewDecisions.Approved, Sha);
        Assert.Equal(2, (await h.EventsAsync(issue.Key)).Count);
        Assert.Equal(Now.AddMinutes(1), h.Db.Issues.Single().UpdatedAt);
    }

    [Fact]
    public async Task AChangedReviewDecision_WritesOneEvent()
    {
        var h = await NewAsync();
        var issue = await h.FileWithPullRequestAsync();
        await h.PutAsync(issue, Request());

        await h.PutAsync(issue, Request() with { ReviewDecision = ReviewDecisions.ChangesRequested });

        var events = await h.EventsAsync(issue.Key);
        Assert.Equal(2, events.Count);
        var payload = events.Last().Payload!.Value;
        AssertSide(payload.GetProperty("from"), MergeStates.Clean, ReviewDecisions.Approved, Sha);
        AssertSide(payload.GetProperty("to"), MergeStates.Clean, ReviewDecisions.ChangesRequested, Sha);
    }

    [Fact]
    public async Task AChangedHeadSha_WritesOneEvent()
    {
        var h = await NewAsync();
        var issue = await h.FileWithPullRequestAsync();
        await h.PutAsync(issue, Request());

        await h.PutAsync(issue, Request() with { HeadSha = OtherSha });

        var events = await h.EventsAsync(issue.Key);
        Assert.Equal(2, events.Count);
        var payload = events.Last().Payload!.Value;
        AssertSide(payload.GetProperty("from"), MergeStates.Clean, ReviewDecisions.Approved, Sha);
        AssertSide(payload.GetProperty("to"), MergeStates.Clean, ReviewDecisions.Approved, OtherSha);
    }

    // ---- What is accepted ----

    [Fact]
    public async Task SurroundingWhitespace_IsTrimmedAndAccepted()
    {
        var h = await NewAsync();
        var issue = await h.FileWithPullRequestAsync();

        var padded = new PullRequestStateRequest(
            $"  {Url}\n", $" {Sha} ", $" {MergeStates.Clean} ", $"\t{ReviewDecisions.Approved}", "box:/work/repo");
        Assert.IsType<NoContentResult>(await h.PutAsync(issue, padded));

        var row = h.Db.Issues.Single();
        Assert.Equal(MergeStates.Clean, row.PullRequestMergeState);
        Assert.Equal(ReviewDecisions.Approved, row.PullRequestReviewDecision);
        Assert.Equal(Sha, row.PullRequestHeadSha);
    }

    [Fact]
    public async Task TheColumnIsNotChecked()
    {
        var h = await NewAsync();
        var issue = await h.FileWithPullRequestAsync();

        // Filed into the first column and never moved: a state read before
        // anybody moved the ticket is still true.
        var first = await h.Db.Statuses.OrderBy(s => s.SortOrder).FirstAsync();
        Assert.Equal(first.Id, issue.StatusId);
        Assert.IsType<NoContentResult>(await h.PutAsync(issue, Request()));
    }

    // ---- The gate ----

    [Fact]
    public void WritingOne_IsOpenToAHatchScopedKey()
    {
        var guard = typeof(PullRequestStateController)
            .GetCustomAttributes(typeof(RequireRoleAttribute), inherit: false)
            .Cast<RequireRoleAttribute>()
            .Single();

        // The caller is a runner, and a state only a person could enter would
        // be one nobody ever entered.
        Assert.Equal(ApiKeyScopes.Hatch, guard.AcceptScope);
    }

    // ---- Harness ----

    private static readonly DateTimeOffset Now = new(2026, 9, 9, 12, 0, 0, TimeSpan.Zero);

    private static PullRequestStateRequest Request() =>
        new(Url, Sha, MergeStates.Clean, ReviewDecisions.Approved, "box:/work/repo");

    private static void AssertSide(JsonElement side, string mergeState, string reviewDecision, string headSha)
    {
        Assert.Equal(mergeState, side.GetProperty("mergeState").GetString());
        Assert.Equal(reviewDecision, side.GetProperty("reviewDecision").GetString());
        Assert.Equal(headSha, side.GetProperty("headSha").GetString());
    }

    private sealed class Harness
    {
        public required HatchContext Db { get; init; }
        public required PullRequestStateController State { get; init; }
        public required IssuesController Issues { get; init; }
        public required IssueThreadController Thread { get; init; }
        public required FakeTimeProvider Time { get; init; }
        public required int ProjectId { get; init; }

        /// <summary>An issue with <see cref="Url"/> written straight onto its row - what records one is another route's business.</summary>
        public async Task<IssueDto> FileWithPullRequestAsync()
        {
            var created = await Issues.CreateIssue(new IssueCreateRequest(ProjectId, "task", "a thing", null, null, null, null), default);
            var issue = created.Result is CreatedAtActionResult c
                ? (IssueDto)c.Value!
                : created.Value ?? throw new InvalidOperationException("expected a created issue");

            var row = await Db.Issues.SingleAsync();
            row.PullRequestUrl = Url;
            await Db.SaveChangesAsync();
            return issue;
        }

        public Task<IActionResult> PutAsync(IssueDto issue, PullRequestStateRequest request) =>
            State.PutPullRequestState(issue.Key, request, default);

        /// <summary>The state's own events, oldest first.</summary>
        public async Task<IReadOnlyList<IssueEventDto>> EventsAsync(string key)
        {
            var events = await Thread.GetEvents(key, default);
            return (events.Value ?? throw new InvalidOperationException("expected events"))
                .Where(e => e.Kind == EfHatchIssueEvent.PullRequestStateChanged)
                .Reverse()
                .ToList();
        }
    }

    private static async Task<Harness> NewAsync()
    {
        var db = new HatchContext(
            new DbContextOptionsBuilder<HatchContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

        var hatch = new EfHatchProject { Key = "AER", Name = "Hatch", CreatedAt = Now };
        db.Add(hatch);
        db.Add(new EfHatchStatus { Name = "inbox", SortOrder = 10 });
        db.Add(new EfHatchStatus { Name = "done", SortOrder = 20, IsTerminal = true });
        await db.SaveChangesAsync();

        var time = new FakeTimeProvider(Now);
        var caller = new MergeCheckControllerTests.StubCallerIdentity
        {
            Person = new EfPerson { Name = "Nathan", CreatedAt = Now, UpdatedAt = Now },
        };
        var actors = new StubActorDirectory();

        return new Harness
        {
            Db = db,
            State = new PullRequestStateController(db, caller, time),
            Issues = new IssuesController(db, new RankService(db), actors, TestClaims.With(), caller, time, new ProjectAccess(db, actors)),
            Thread = new IssueThreadController(db, caller, time),
            Time = time,
            ProjectId = hatch.Id,
        };
    }
}
