using Hatch.Api.Modules.Hatch;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// The per-issue half of the Timeline fold: a status-change payload read as a
/// change, and one issue's changes folded into the segments it spent in an
/// active column. In memory throughout - the report is pure.
/// </summary>
public class TimelineReportTests
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

    private static TimelineReport.Row Epic(long id, int status, DateTimeOffset createdAt) =>
        new(id, null, 1, "HA", (int)id, "epic", status, id, createdAt, "ann");

    private static string NameOf(int id) => Board().Single(s => s.Id == id).Name;

    // Names and ids both filled from the board, unless an argument says otherwise:
    // pass nameFrom/nameTo to override a name, and null the id to get a name-only event.
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

    private static (IReadOnlyList<TimelineReport.Segment> Segments, int Unresolved) Run(
        TimelineReport.Row row, TimelineReport.Change[] changes, DateTimeOffset from, DateTimeOffset to,
        List<EfHatchStatus>? board = null) =>
        TimelineReport.SegmentsOf(row, changes, TimelineReport.IndexOf(board ?? Board()), from, to);

    [Fact]
    public void AnIssueNeverMovedOutOfTheFirstColumn_HasNoSegments()
    {
        var (segments, unresolved) = Run(Epic(1, 1, Day(-10)), [], Day(-5), Day(5));

        Assert.Empty(segments);
        Assert.Equal(0, unresolved);
    }

    [Fact]
    public void AMoveOutOfTheFirstColumnAndIntoATerminal_IsOneSegmentPerActiveColumnVisited()
    {
        var changes = new[]
        {
            Move(1, 1, Day(1), 1, 2),
            Move(1, 2, Day(3), 2, 3),
            Move(1, 3, Day(4), 3, 4),
            Move(1, 4, Day(6), 4, 5),
        };

        var (segments, unresolved) = Run(Epic(1, 5, Day(-10)), changes, Day(-5), Day(20));

        Assert.Equal(
        [
            new TimelineReport.Segment(2, Day(1), Day(3)),
            new TimelineReport.Segment(3, Day(3), Day(4)),
            new TimelineReport.Segment(4, Day(4), Day(6)),
        ], segments);
        Assert.Equal(0, unresolved);
    }

    [Fact]
    public void AnIssueWithNoChangeBornInAnActiveColumn_IsActiveFromCreatedAt()
    {
        var (segments, _) = Run(Epic(1, 3, Day(-2)), [], Day(-5), Day(5));

        Assert.Equal([new TimelineReport.Segment(3, Day(-2), null)], segments);
    }

    [Fact]
    public void AFirstMoveAfterTheRange_PlacesTheIssueInThatMovesFromColumn()
    {
        // Currently in review, but it was in doing until Day(10), after the range.
        var changes = new[] { Move(1, 1, Day(10), 3, 4) };

        var (segments, _) = Run(Epic(1, 4, Day(-10)), changes, Day(0), Day(5));

        Assert.Equal([new TimelineReport.Segment(3, Day(0), null)], segments);
    }

    [Fact]
    public void ADeferredStretch_IsAGap()
    {
        var changes = new[]
        {
            Move(1, 1, Day(0), 1, 2),
            Move(1, 2, Day(2), 2, 6),
            Move(1, 3, Day(4), 6, 2),
        };

        var (segments, _) = Run(Epic(1, 2, Day(-1)), changes, Day(-5), Day(10));

        Assert.Equal(
        [
            new TimelineReport.Segment(2, Day(0), Day(2)),
            new TimelineReport.Segment(2, Day(4), null),
        ], segments);
    }

    [Fact]
    public void ASameColumnMove_MergesIntoOneSegment()
    {
        var changes = new[]
        {
            Move(1, 1, Day(0), 1, 2),
            Move(1, 2, Day(2), 2, 2),
            Move(1, 3, Day(4), 2, 5),
        };

        var (segments, _) = Run(Epic(1, 5, Day(-1)), changes, Day(-5), Day(10));

        Assert.Equal([new TimelineReport.Segment(2, Day(0), Day(4))], segments);
    }

    [Fact]
    public void AStretchStraddlingTheRange_IsClippedAtBothEnds()
    {
        var changes = new[] { Move(1, 1, Day(-3), 1, 2), Move(1, 2, Day(8), 2, 5) };

        var (segments, _) = Run(Epic(1, 5, Day(-10)), changes, Day(0), Day(5));

        Assert.Equal([new TimelineReport.Segment(2, Day(0), null)], segments);
    }

    [Fact]
    public void AStretchEndingInsideTheRange_KeepsItsEnd_AndOneOutsideIsAbsent()
    {
        var changes = new[]
        {
            Move(1, 1, Day(-8), 1, 2),
            Move(1, 2, Day(-6), 2, 3),
            Move(1, 3, Day(2), 3, 5),
        };

        var (segments, _) = Run(Epic(1, 5, Day(-10)), changes, Day(0), Day(5));

        Assert.Equal([new TimelineReport.Segment(3, Day(0), Day(2))], segments);
    }

    [Fact]
    public void AStretchEndingExactlyAtTo_KeepsItsEnd()
    {
        var changes = new[] { Move(1, 1, Day(1), 1, 2), Move(1, 2, Day(5), 2, 5) };

        var (segments, _) = Run(Epic(1, 5, Day(-10)), changes, Day(0), Day(5));

        Assert.Equal([new TimelineReport.Segment(2, Day(1), Day(5))], segments);
    }

    [Fact]
    public void AStretchBeginningExactlyAtTo_OrEndingExactlyAtFrom_IsAbsent()
    {
        var changes = new[]
        {
            Move(1, 1, Day(-4), 1, 2),
            Move(1, 2, Day(0), 2, 1),
            Move(1, 3, Day(5), 1, 3),
        };

        var (segments, _) = Run(Epic(1, 3, Day(-10)), changes, Day(0), Day(5));

        Assert.Empty(segments);
    }

    [Fact]
    public void AStretchContinuingPastTo_EndsWithANullTo()
    {
        var changes = new[] { Move(1, 1, Day(1), 1, 2), Move(1, 2, Day(9), 2, 5) };

        var (segments, _) = Run(Epic(1, 5, Day(-10)), changes, Day(0), Day(5));

        Assert.Equal([new TimelineReport.Segment(2, Day(1), null)], segments);
    }

    [Fact]
    public void AStretchOnlyOutsideTheRange_IsAbsent()
    {
        var changes = new[] { Move(1, 1, Day(-8), 1, 2), Move(1, 2, Day(-6), 2, 5) };

        var (segments, _) = Run(Epic(1, 5, Day(-10)), changes, Day(0), Day(5));

        Assert.Empty(segments);
    }

    [Fact]
    public void AnEqualRange_HasNoSegments()
    {
        var (segments, _) = Run(Epic(1, 3, Day(-2)), [], Day(1), Day(1));

        Assert.Empty(segments);
    }

    [Fact]
    public void AnIssueReopenedAfterATerminalStretch_HasASecondSegment()
    {
        var changes = new[]
        {
            Move(1, 1, Day(0), 1, 3),
            Move(1, 2, Day(2), 3, 5),
            Move(1, 3, Day(4), 5, 3),
        };

        var (segments, _) = Run(Epic(1, 3, Day(-1)), changes, Day(-5), Day(10));

        Assert.Equal(
        [
            new TimelineReport.Segment(3, Day(0), Day(2)),
            new TimelineReport.Segment(3, Day(4), null),
        ], segments);
    }

    [Fact]
    public void AChangeNamingADeletedColumnByName_DrawsNothing_AndIsCountedUnresolved()
    {
        var changes = new[] { Move(1, 1, Day(0), 1, null, ids: false, toName: "gone") };

        var (segments, unresolved) = Run(Epic(1, 1, Day(-1)), changes, Day(-5), Day(10));

        Assert.Empty(segments);
        Assert.Equal(1, unresolved);
    }

    [Fact]
    public void TheSameChangeCarryingAToId_Resolves()
    {
        var change = new TimelineReport.Change(1, 1, Day(0), "backlog", "gone", 1, 3);

        var (segments, unresolved) = Run(Epic(1, 3, Day(-1)), [change], Day(-5), Day(10));

        Assert.Equal([new TimelineReport.Segment(3, Day(0), null)], segments);
        Assert.Equal(0, unresolved);
    }

    [Fact]
    public void AnIdNamingADeletedColumn_IsUnresolvedEvenWhenItsNameMatchesALiveColumn()
    {
        // Id 99 is gone; its name was reused by the live column 3.
        var change = new TimelineReport.Change(1, 1, Day(0), "backlog", "doing", 1, 99);

        var (segments, unresolved) = Run(Epic(1, 3, Day(-1)), [change], Day(-5), Day(10));

        Assert.Empty(segments);
        Assert.Equal(1, unresolved);
    }

    [Fact]
    public void ANameOnlyChangeMatchingACurrentColumn_Resolves()
    {
        var changes = new[] { Move(1, 1, Day(0), 1, 3, ids: false) };

        var (segments, unresolved) = Run(Epic(1, 3, Day(-1)), changes, Day(-5), Day(10));

        Assert.Equal([new TimelineReport.Segment(3, Day(0), null)], segments);
        Assert.Equal(0, unresolved);
    }

    [Fact]
    public void AnUnresolvedStretchOutsideTheRange_IsNotCounted()
    {
        var changes = new[]
        {
            Move(1, 1, Day(-8), 1, null, ids: false, toName: "gone"),
            Move(1, 2, Day(-6), 1, 3),
        };

        var (segments, unresolved) = Run(Epic(1, 3, Day(-10)), changes, Day(0), Day(5));

        Assert.Equal([new TimelineReport.Segment(3, Day(0), null)], segments);
        Assert.Equal(0, unresolved);
    }

    [Fact]
    public void ABoardWithOneColumn_DrawsNothing()
    {
        var board = new List<EfHatchStatus> { new() { Id = 1, Name = "backlog", SortOrder = 10 } };

        var (segments, _) = Run(Epic(1, 1, Day(-1)), [], Day(-5), Day(5), board);

        Assert.Empty(segments);
    }

    [Fact]
    public void ParseChange_ReadsNames()
    {
        var change = TimelineReport.ParseChange(7, 9, Day(1), """{"from":"todo","to":"doing"}""");

        Assert.Equal(new TimelineReport.Change(7, 9, Day(1), "todo", "doing", null, null), change);
    }

    [Fact]
    public void ParseChange_ReadsNamesAndIds()
    {
        var change = TimelineReport.ParseChange(7, 9, Day(1), """{"from":"todo","to":"doing","fromId":2,"toId":3}""");

        Assert.Equal(new TimelineReport.Change(7, 9, Day(1), "todo", "doing", 2, 3), change);
    }

    [Fact]
    public void ParseChange_ANullFrom_IsLegal()
    {
        var change = TimelineReport.ParseChange(7, 9, Day(1), """{"from":null,"to":"doing","fromId":null,"toId":3}""");

        Assert.Equal(new TimelineReport.Change(7, 9, Day(1), null, "doing", null, 3), change);
    }

    [Fact]
    public void ParseChange_AnUnparseablePayload_IsIgnored()
    {
        Assert.Null(TimelineReport.ParseChange(7, 9, Day(1), "{not json"));
        Assert.Null(TimelineReport.ParseChange(7, 9, Day(1), null));
    }

    [Fact]
    public void ParseChange_ANonObjectPayload_IsIgnored()
    {
        Assert.Null(TimelineReport.ParseChange(7, 9, Day(1), """["todo","doing"]"""));
        Assert.Null(TimelineReport.ParseChange(7, 9, Day(1), "3"));
    }

    [Fact]
    public void ParseChange_NoTo_IsIgnored()
    {
        Assert.Null(TimelineReport.ParseChange(7, 9, Day(1), """{"from":"todo","fromId":2}"""));
        Assert.Null(TimelineReport.ParseChange(7, 9, Day(1), """{"from":"todo","to":null,"toId":null}"""));
    }
}
