using Hatch.Api.Modules.Hatch;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// The pure fold: how many issues sat in each board column at each instant,
/// pinned against hand-built histories the way <see cref="TimelineReportTests"/>
/// pins the per-issue segments it is built from. In memory throughout.
/// </summary>
public class CumulativeFlowReportTests
{
    private static readonly DateTimeOffset Now = new(2026, 1, 31, 0, 0, 0, TimeSpan.Zero);

    private static DateTimeOffset Day(int n) => Now.AddDays(n);

    // First column 1, two active 2 and 3, review 4, terminal 5, deferred 6.
    private static List<EfHatchStatus> Board() =>
    [
        new() { Id = 1, Name = "backlog", SortOrder = 10 },
        new() { Id = 2, Name = "todo", SortOrder = 20 },
        new() { Id = 3, Name = "doing", SortOrder = 30 },
        new() { Id = 4, Name = "review", SortOrder = 40 },
        new() { Id = 5, Name = "done", SortOrder = 50, IsTerminal = true },
        new() { Id = 6, Name = "parked", SortOrder = 60, IsDeferred = true },
    ];

    private static TimelineReport.Row Issue(
        long id, string type, int status, DateTimeOffset createdAt, long? parent = null, int project = 1,
        string key = "HA", string by = "ann", long? rank = null, int? number = null) =>
        new(id, parent, project, key, number ?? (int)id, type, status, rank ?? id, createdAt, by);

    private static string NameOf(int id) => Board().Single(s => s.Id == id).Name;

    private static TimelineReport.Change Move(
        long issue, long eventId, DateTimeOffset at, int? from, int? to,
        bool names = true, bool ids = true, string? toName = null)
    {
        return new TimelineReport.Change(
            issue, eventId, at,
            names && from is { } f ? NameOf(f) : null,
            toName ?? (names && to is { } t ? NameOf(t) : null),
            ids ? from : null,
            ids ? to : null);
    }

    private static CumulativeFlowReport.Result Fold(
        TimelineReport.Row[] rows, TimelineReport.Change[]? changes = null,
        DateTimeOffset? from = null, DateTimeOffset? to = null, DateTimeOffset? now = null,
        List<EfHatchStatus>? board = null)
    {
        var resolvedTo = to ?? Day(5);
        return CumulativeFlowReport.Fold(
            rows, changes ?? [], board ?? Board(), from ?? Day(-5), resolvedTo, now ?? resolvedTo);
    }

    [Fact]
    public void Columns_AreNonDeferredIds_InSortOrderThenId()
    {
        var board = new List<EfHatchStatus>
        {
            new() { Id = 5, Name = "done", SortOrder = 50, IsTerminal = true },
            new() { Id = 2, Name = "todo", SortOrder = 20 },
            new() { Id = 6, Name = "parked", SortOrder = 20, IsDeferred = true },
            new() { Id = 3, Name = "doing", SortOrder = 20 },
            new() { Id = 1, Name = "backlog", SortOrder = 10 },
            new() { Id = 4, Name = "review", SortOrder = 40 },
        };

        var result = Fold([Issue(1, "epic", 1, Day(-1))], board: board);

        Assert.Equal([1, 2, 3, 4, 5], result.Columns);
    }

    [Fact]
    public void AMoveInstant_CountsTheColumnMovedTo_NotLeft_AndTheFirstColumnCountsToo()
    {
        var row = Issue(1, "epic", 1, Day(-10));
        var changes = new[] { Move(1, 1, Day(-3), 1, 2) };

        var result = Fold([row], changes, from: Day(-5), to: Day(0), now: Day(0));

        var before = result.Points.Single(p => p.At == Day(-5));
        var at = result.Points.Single(p => p.At == Day(-3));
        var after = result.Points.Single(p => p.At == Day(0));

        Assert.Equal(1, before.Counts[0]);
        Assert.Equal(0, before.Counts[1]);
        Assert.Equal(0, at.Counts[0]);
        Assert.Equal(1, at.Counts[1]);
        Assert.Equal(1, after.Counts[1]);
    }

    [Fact]
    public void ATerminalColumn_CountsToo()
    {
        var row = Issue(1, "epic", 5, Day(-10));

        var result = Fold([row], from: Day(-5), to: Day(0), now: Day(0));

        Assert.All(result.Points, p => Assert.Equal(1, p.Counts[4]));
    }

    [Fact]
    public void AcrossSeveralMoves_EachPointCountsTheColumnHeldAtThatInstant()
    {
        var row = Issue(1, "epic", 5, Day(-10));
        var changes = new[]
        {
            Move(1, 1, Day(-8), 1, 2),
            Move(1, 2, Day(-6), 2, 3),
            Move(1, 3, Day(-4), 3, 4),
            Move(1, 4, Day(-2), 4, 5),
        };

        var result = Fold([row], changes, from: Day(-9), to: Day(0), now: Day(0));

        Assert.Equal(1, result.Points.Single(p => p.At == Day(-9)).Counts[0]);
        Assert.Equal(1, result.Points.Single(p => p.At == Day(-8)).Counts[1]);
        Assert.Equal(1, result.Points.Single(p => p.At == Day(-6)).Counts[2]);
        Assert.Equal(1, result.Points.Single(p => p.At == Day(-4)).Counts[3]);
        Assert.Equal(1, result.Points.Single(p => p.At == Day(-2)).Counts[4]);
    }

    [Fact]
    public void ADeferredStretch_IsInNoColumn_AndDoesNotRaiseUnresolved()
    {
        var row = Issue(1, "epic", 2, Day(-10));
        var changes = new[]
        {
            Move(1, 1, Day(-8), 1, 2),
            Move(1, 2, Day(-6), 2, 6),
            Move(1, 3, Day(-4), 6, 2),
        };

        var result = Fold([row], changes, from: Day(-9), to: Day(0), now: Day(0));

        var during = result.Points.Single(p => p.At == Day(-6));
        Assert.Equal(0, during.Counts.Sum());
        Assert.Equal(0, result.Unresolved);
    }

    [Fact]
    public void AnUnresolvedStretch_IsInNoColumn_CountsOnce_AndMatchesTimelinesUnresolved()
    {
        // Status 999 names no current column: unresolved for the issue's whole life.
        var row = Issue(1, "epic", 999, Day(-10));
        var from = Day(-9);
        var to = Day(0);

        var result = Fold([row], from: from, to: to, now: to);

        Assert.Equal(1, result.Unresolved);
        Assert.All(result.Points, p => Assert.Equal(0, p.Counts.Sum()));

        var timeline = TimelineReport.Fold([row], [], Board(), from, to, null, null);
        Assert.Equal(timeline.Unresolved, result.Unresolved);
    }

    [Fact]
    public void AZeroLengthStretch_IsDroppedBeforeCounting_EitherWay()
    {
        var row = Issue(1, "epic", 1, Day(-10));
        var changes = new[]
        {
            Move(1, 1, Day(-5), 1, 2),
            Move(1, 2, Day(-5), 2, 3),
        };

        var result = Fold([row], changes, from: Day(-9), to: Day(0), now: Day(0));

        Assert.Equal(0, result.Unresolved);
        var at = result.Points.Single(p => p.At == Day(-5));
        Assert.Equal(0, at.Counts[1]);
        Assert.Equal(1, at.Counts[2]);
    }

    [Fact]
    public void TwoIssues_AddInTheSameColumn()
    {
        var rows = new[] { Issue(1, "epic", 3, Day(-10)), Issue(2, "story", 3, Day(-8)) };

        var result = Fold(rows, from: Day(-9), to: Day(0), now: Day(0));

        Assert.Equal(2, result.Points.Last().Counts[2]);
    }

    [Fact]
    public void EveryType_Counts_EpicStoryAndTask()
    {
        var rows = new[]
        {
            Issue(1, "epic", 2, Day(-10)),
            Issue(2, "story", 3, Day(-10)),
            Issue(3, "task", 4, Day(-10)),
        };

        var result = Fold(rows, from: Day(-5), to: Day(0), now: Day(0));

        var point = result.Points.Last();
        Assert.Equal(1, point.Counts[1]);
        Assert.Equal(1, point.Counts[2]);
        Assert.Equal(1, point.Counts[3]);
    }

    [Fact]
    public void ToAfterNow_EndsTheSweepAtNow_ButEchoesToAsGiven()
    {
        var row = Issue(1, "epic", 3, Day(-10));
        var changes = new[] { Move(1, 1, Day(-2), 1, 3) };
        var now = Day(0);
        var to = Day(10);

        var result = Fold([row], changes, from: Day(-5), to: to, now: now);

        Assert.Equal(to, result.To);
        Assert.Equal(now, result.Points.Last().At);
        Assert.Equal(1, result.Points.Last().Counts[2]);
    }

    [Fact]
    public void ToBeforeNow_OffGrid_EndsWithAPointAtTo_OnGrid_AddsNone()
    {
        var row = Issue(1, "epic", 1, Day(-10));
        var from = Day(-5);
        var now = Day(0);

        var offGrid = Fold([row], from: from, to: from.AddHours(2.5), now: now);
        Assert.Equal(
            [from, from.AddHours(1), from.AddHours(2), from.AddHours(2.5)],
            offGrid.Points.Select(p => p.At));

        var onGrid = Fold([row], from: from, to: from.AddHours(3), now: now);
        Assert.Equal(
            [from, from.AddHours(1), from.AddHours(2), from.AddHours(3)],
            onGrid.Points.Select(p => p.At));
    }

    [Fact]
    public void NoIssues_AnswersEmptyPoints_ColumnsListed_UnresolvedZero_FromUntouched()
    {
        var result = Fold([], from: Day(-5), to: Day(5), now: Day(5));

        Assert.Empty(result.Points);
        Assert.Equal([1, 2, 3, 4, 5], result.Columns);
        Assert.Equal(0, result.Unresolved);
        Assert.Equal(Day(-5), result.From);
    }

    [Fact]
    public void EveryIssueCreatedAfterEnd_AnswersTheSameAsNoIssues()
    {
        var row = Issue(1, "epic", 1, Day(10));

        var result = Fold([row], from: Day(-5), to: Day(5), now: Day(5));

        Assert.Empty(result.Points);
        Assert.Equal(0, result.Unresolved);
        Assert.Equal(Day(-5), result.From);
    }

    [Fact]
    public void ClampPullsFromForwardToFirstCreatedAt_WhenStartIsEarlier()
    {
        var row = Issue(1, "epic", 2, Day(-3));

        var result = Fold([row], from: Day(-10), to: Day(0), now: Day(0));

        Assert.Equal(Day(-3), result.From);
        Assert.Equal(Day(-3), result.Points.First().At);
        Assert.Equal(1, result.Points.First().Counts[1]);
    }

    [Fact]
    public void ClampLeavesFromUntouched_WhenStartIsAlreadyAtOrAfterFirstCreatedAt()
    {
        var row = Issue(1, "epic", 2, Day(-10));

        var result = Fold([row], from: Day(-5), to: Day(0), now: Day(0));

        Assert.Equal(Day(-5), result.From);
    }

    [Fact]
    public void ClampLeavesFromUntouched_WhenFirstCreatedAtIsAfterEnd()
    {
        var row = Issue(1, "epic", 2, Day(10));

        var result = Fold([row], from: Day(-5), to: Day(0), now: Day(0));

        Assert.Equal(Day(-5), result.From);
        Assert.Empty(result.Points);
    }

    [Theory]
    [InlineData(999, "hour")]
    [InlineData(1000, "day")]
    [InlineData(998.5, "hour")]
    [InlineData(999.5, "day")]
    public void StepRule_AtTheHourDayBoundary(double hours, string expected)
    {
        var from = Day(0);
        var to = from.AddHours(hours);
        var row = Issue(1, "epic", 1, from);

        var result = Fold([row], from: from, to: to, now: to);

        Assert.Equal(expected, result.Step);
    }

    [Fact]
    public void StepRule_999Hours_Is1000Points()
    {
        var from = Day(0);
        var to = from.AddHours(999);
        var row = Issue(1, "epic", 1, from);

        var result = Fold([row], from: from, to: to, now: to);

        Assert.Equal("hour", result.Step);
        Assert.Equal(1000, result.Points.Count);
    }

    [Theory]
    [InlineData(999, "day")]
    [InlineData(1000, "week")]
    public void StepRule_AtTheDayWeekBoundary(double days, string expected)
    {
        var from = Day(0);
        var to = from.AddDays(days);
        var row = Issue(1, "epic", 1, from);

        var result = Fold([row], from: from, to: to, now: to);

        Assert.Equal(expected, result.Step);
    }

    [Fact]
    public void StepRule_AThirtyYearRange_IsWeek_EvenOverCap()
    {
        var from = Day(0);
        var to = from.AddYears(30);
        var row = Issue(1, "epic", 1, from);

        var result = Fold([row], from: from, to: to, now: to);

        Assert.Equal("week", result.Step);
        Assert.True(result.Points.Count > WorkLogController.MaxBuckets);
    }
}
