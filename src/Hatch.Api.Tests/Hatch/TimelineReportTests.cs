using Hatch.Api.Modules.Hatch;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

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

    private static TimelineReport.Row Issue(
        long id, string type, int status, DateTimeOffset createdAt, long? parent = null, int project = 1,
        string key = "HA", string by = "ann", long? rank = null, int? number = null) =>
        new(id, parent, project, key, number ?? (int)id, type, status, rank ?? id, createdAt, by);

    private static TimelineReport.Row Epic(long id, int status, DateTimeOffset createdAt) =>
        Issue(id, "epic", status, createdAt);

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

    // A row in an active column with no history is active from its creation, and one in the
    // first column is never active: most of the fold's tests need no changes at all.
    private static TimelineReport.Result Fold(
        TimelineReport.Row[] rows, TimelineReport.Change[]? changes = null, int? projectId = null, string? createdBy = null) =>
        TimelineReport.Fold(rows, changes ?? [], Board(), Day(-5), Day(5), projectId, createdBy);

    private static long?[] Ids(IEnumerable<TimelineReport.Node> nodes) => nodes.Select(n => n.IssueId).ToArray();

    [Fact]
    public void Fold_AnEpicInTheFirstColumnNeverMoved_IsAbsentFromEpics()
    {
        var result = Fold([Issue(1, "epic", 1, Day(-1))]);

        Assert.Empty(result.Epics);
        Assert.Null(result.Other);
    }

    [Fact]
    public void Fold_ChildrenWithNoActivityAreOmitted_AndAParentIsKeptByItsDescendant()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-1)),
            Issue(2, "story", 5, Day(-30), parent: 1),
            Issue(3, "task", 3, Day(-1), parent: 2),
            Issue(4, "task", 1, Day(-1), parent: 2),
            Issue(5, "story", 1, Day(-1), parent: 1),
        };
        var changes = new[] { Move(2, 1, Day(-20), 1, 3), Move(2, 2, Day(-10), 3, 5) };

        var epic = Assert.Single(Fold(rows, changes).Epics);

        var story = Assert.Single(epic.Children);
        Assert.Equal(2, story.IssueId);
        Assert.Empty(story.Segments);
        Assert.Equal<long?[]>([3], Ids(story.Children));
    }

    [Fact]
    public void Fold_AnEpicWithOnlyDescendantActivity_IsAbsentFromEpics()
    {
        var rows = new[] { Issue(1, "epic", 1, Day(-1)), Issue(2, "task", 3, Day(-1), parent: 1) };

        Assert.Empty(Fold(rows).Epics);
    }

    [Fact]
    public void Fold_IsLeafIsTrueOnlyWhereTheTrackerHasNoChildren_EvenWhenChildrenWereNotKept()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-1)),
            Issue(2, "story", 3, Day(-1), parent: 1),
            Issue(3, "task", 1, Day(-1), parent: 2),
            Issue(4, "story", 3, Day(-1), parent: 1),
        };

        var epic = Assert.Single(Fold(rows).Epics);

        Assert.False(epic.IsLeaf);
        var withIdleChild = epic.Children.Single(n => n.IssueId == 2);
        Assert.False(withIdleChild.IsLeaf);
        Assert.Empty(withIdleChild.Children);
        Assert.True(epic.Children.Single(n => n.IssueId == 4).IsLeaf);
    }

    [Fact]
    public void Fold_ChildrenComeInRankOrder()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-1)),
            Issue(2, "story", 3, Day(-1), parent: 1, rank: 30),
            Issue(3, "story", 3, Day(-1), parent: 1, rank: 10),
            Issue(4, "story", 3, Day(-1), parent: 1, rank: 10),
            Issue(5, "story", 3, Day(-1), parent: 1, rank: 20),
        };

        var epic = Assert.Single(Fold(rows).Epics);

        Assert.Equal<long?[]>([3, 4, 5, 2], Ids(epic.Children));
    }

    [Fact]
    public void Fold_EpicsAreOrderedByFirstSegmentStart_ThenKey_ThenNumber()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-2), key: "ZZ", number: 1),
            Issue(2, "epic", 3, Day(-3), key: "BB", number: 9),
            Issue(3, "epic", 3, Day(-2), key: "AA", number: 5),
            Issue(4, "epic", 3, Day(-2), key: "AA", number: 2),
        };

        Assert.Equal<long?[]>([2, 4, 3, 1], Ids(Fold(rows).Epics));
    }

    [Fact]
    public void Fold_AnEpicUnderANonEpic_IsAnEpic_AndIsNotDrawnAgainUnderItsAncestors()
    {
        var rows = new[]
        {
            Issue(1, "story", 3, Day(-1)),
            Issue(2, "epic", 3, Day(-1), parent: 1),
            Issue(3, "epic", 3, Day(-1)),
            Issue(4, "story", 3, Day(-1), parent: 3),
            Issue(5, "epic", 3, Day(-1), parent: 4),
        };

        var result = Fold(rows);

        Assert.Equal<long?[]>([2, 3, 5], Ids(result.Epics).OrderBy(i => i).ToArray());
        var under = result.Epics.Single(e => e.IssueId == 3);
        Assert.Equal<long?[]>([4], Ids(under.Children));
        Assert.Empty(under.Children[0].Children);
    }

    [Fact]
    public void Fold_AnEpicWhoseParentIsNotInRows_IsTopLevel()
    {
        var rows = new[] { Issue(1, "epic", 3, Day(-1), parent: 99) };

        Assert.Equal<long?[]>([1], Ids(Fold(rows).Epics));
    }

    [Fact]
    public void Fold_ANestedEpic_AppearsOnceUnderItsParent_NotInEpics()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-1)),
            Issue(2, "epic", 3, Day(-1), parent: 1),
        };

        var epic = Assert.Single(Fold(rows).Epics);

        Assert.Equal(1, epic.IssueId);
        Assert.Equal<long?[]>([2], Ids(epic.Children));
    }

    [Fact]
    public void Fold_ProjectIdAndCreatedBy_NarrowTopLevelRows_AndLeaveChildrenIntact()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-1), project: 1, by: "ann"),
            Issue(2, "task", 3, Day(-1), parent: 1, project: 2, by: "bob"),
            Issue(3, "epic", 3, Day(-1), project: 2, by: "bob"),
            Issue(4, "task", 3, Day(-1), parent: 3, project: 1, by: "ann"),
        };

        var byProject = Assert.Single(Fold(rows, projectId: 1).Epics);
        Assert.Equal(1, byProject.IssueId);
        Assert.Equal<long?[]>([2], Ids(byProject.Children));

        var byCreator = Assert.Single(Fold(rows, createdBy: "bob").Epics);
        Assert.Equal(3, byCreator.IssueId);
        Assert.Equal<long?[]>([4], Ids(byCreator.Children));

        Assert.Empty(Fold(rows, projectId: 1, createdBy: "bob").Epics);
    }

    [Fact]
    public void Fold_CreatedByIsTrimmedAndExact_AndBlankMeansNone()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-1), by: "Ann"),
            Issue(2, "epic", 3, Day(-1), by: "ann"),
            Issue(3, "epic", 3, Day(-1), by: "Annabel"),
        };

        Assert.Equal<long?[]>([1], Ids(Fold(rows, createdBy: "Ann").Epics));
        Assert.Equal<long?[]>([1], Ids(Fold(rows, createdBy: "  Ann ").Epics));
        Assert.Equal(3, Fold(rows, createdBy: "  ").Epics.Count);
        Assert.Equal(3, Fold(rows, createdBy: "").Epics.Count);
    }

    [Fact]
    public void Fold_Creators_IgnoreCreatedBy_HonourProjectId_AndAreSortedDistinctNonBlank()
    {
        var rows = new[]
        {
            Issue(1, "epic", 3, Day(-1), by: "bob"),
            Issue(2, "epic", 3, Day(-1), by: "Ann"),
            Issue(3, "epic", 3, Day(-1), by: "bob"),
            Issue(4, "epic", 3, Day(-1), by: " "),
            Issue(5, "epic", 3, Day(-1), by: "zed", project: 2),
            Issue(6, "epic", 1, Day(-1), by: "idle"),
            Issue(7, "story", 1, Day(-1), by: "loner"),
            Issue(8, "story", 3, Day(-1), by: "kept"),
            Issue(9, "task", 3, Day(-1), parent: 7, by: "child"),
        };

        var all = Fold(rows, createdBy: "bob");
        Assert.Equal(["Ann", "bob", "kept", "loner", "zed"], all.Creators);
        Assert.DoesNotContain("idle", all.Creators);
        Assert.DoesNotContain("child", all.Creators);

        Assert.Equal(["Ann", "bob", "kept", "loner"], Fold(rows, projectId: 1).Creators);
        Assert.Equal(["zed"], Fold(rows, projectId: 2).Creators);
    }

    [Fact]
    public void Fold_AParentCycle_Terminates_AndAnEpicBesideItIsIntact()
    {
        var rows = new[]
        {
            Issue(1, "story", 3, Day(-1), parent: 2),
            Issue(2, "story", 3, Day(-1), parent: 1),
            Issue(3, "epic", 3, Day(-1)),
        };

        var result = Fold(rows);

        Assert.Equal<long?[]>([3], Ids(result.Epics));
        Assert.Equal(0, result.Unresolved);
    }

    [Fact]
    public void Fold_Unresolved_SumsAcrossASubtree_AndCountsForAnAbsentRow_AndHonoursTheFilters()
    {
        TimelineReport.Change Gone(long issue) => Move(issue, issue, Day(-3), 1, null, ids: false, toName: "gone");

        var rows = new[]
        {
            Issue(1, "epic", 1, Day(-10), project: 1, by: "ann"),
            Issue(2, "epic", 3, Day(-10), project: 2, by: "bob"),
            Issue(3, "story", 1, Day(-10), parent: 2, project: 2, by: "bob"),
            Issue(4, "task", 1, Day(-10), parent: 3, project: 2, by: "bob"),
        };
        var changes = new[] { Gone(1), Gone(3), Gone(4) };

        var result = Fold(rows, changes);
        Assert.Equal<long?[]>([2], Ids(result.Epics));
        Assert.Equal(3, result.Unresolved);

        Assert.Equal(1, Fold(rows, changes, projectId: 1).Unresolved);
        Assert.Equal(2, Fold(rows, changes, projectId: 2).Unresolved);
        Assert.Equal(2, Fold(rows, changes, createdBy: "bob").Unresolved);
        Assert.Equal(0, Fold(rows, changes, projectId: 1, createdBy: "bob").Unresolved);
    }

    [Fact]
    public void Fold_LooseWork_FoldsIntoOther_WithTheStoryAsItsChildAndTheTaskBeneathIt()
    {
        var rows = new[] { Issue(1, "story", 1, Day(-1)), Issue(2, "task", 3, Day(-1), parent: 1) };

        var result = Fold(rows);

        Assert.Empty(result.Epics);
        var other = Assert.IsType<TimelineReport.Node>(result.Other);
        Assert.Null(other.IssueId);
        Assert.Equal("", other.CreatedBy);
        Assert.False(other.IsLeaf);
        var story = Assert.Single(other.Children);
        Assert.Equal(1, story.IssueId);
        Assert.Equal<long?[]>([2], Ids(story.Children));
    }

    [Fact]
    public void Fold_Other_IsNullWithNoLooseWork_AndWhenTheLooseWorkHasNoActivity()
    {
        Assert.Null(Fold([Issue(1, "epic", 3, Day(-1))]).Other);

        var idle = new[] { Issue(1, "story", 1, Day(-1)), Issue(2, "task", 1, Day(-1), parent: 1) };
        Assert.Null(Fold(idle).Other);
    }

    [Fact]
    public void Fold_OtherHull_RunsFromTheEarliestStartToTheLatestEnd_AcrossRootsAndDescendants()
    {
        var rows = new[]
        {
            Issue(1, "story", 5, Day(-30)),
            Issue(2, "task", 5, Day(-30), parent: 1),
            Issue(3, "story", 5, Day(-30)),
        };
        var changes = new[]
        {
            Move(1, 1, Day(-3), 1, 3), Move(1, 2, Day(-1), 3, 5),
            Move(2, 3, Day(-4), 1, 4), Move(2, 4, Day(2), 4, 5),
            Move(3, 5, Day(0), 1, 3), Move(3, 6, Day(3), 3, 5),
        };

        var other = Assert.IsType<TimelineReport.Node>(Fold(rows, changes).Other);

        Assert.Equal([new TimelineReport.Segment(4, Day(-4), Day(3))], other.Segments);
    }

    [Fact]
    public void Fold_OtherHull_IsOpenWhenAnyDescendantIsStillOpen()
    {
        var rows = new[]
        {
            Issue(1, "story", 5, Day(-30)),
            Issue(2, "task", 3, Day(1), parent: 1),
        };
        var changes = new[] { Move(1, 1, Day(-3), 1, 3), Move(1, 2, Day(-1), 3, 5) };

        var other = Assert.IsType<TimelineReport.Node>(Fold(rows, changes).Other);

        Assert.Equal([new TimelineReport.Segment(3, Day(-3), null)], other.Segments);
    }

    [Fact]
    public void Fold_OtherHull_IsOpenWhenAStretchContinuesPastTheRange()
    {
        var rows = new[] { Issue(1, "story", 5, Day(-30)), Issue(2, "task", 5, Day(-30), parent: 1) };
        var changes = new[]
        {
            Move(1, 1, Day(-3), 1, 3), Move(1, 2, Day(3), 3, 5),
            Move(2, 3, Day(-2), 1, 3), Move(2, 4, Day(8), 3, 5),
        };

        var other = Assert.IsType<TimelineReport.Node>(Fold(rows, changes).Other);

        Assert.Equal([new TimelineReport.Segment(3, Day(-3), null)], other.Segments);
    }

    [Fact]
    public void Fold_OtherHull_TakesTheStatusOfTheEarliestStartingSegment()
    {
        // The task started in review before its story started in doing.
        var rows = new[]
        {
            Issue(1, "story", 3, Day(-2)),
            Issue(2, "task", 4, Day(-4), parent: 1),
        };

        var other = Assert.IsType<TimelineReport.Node>(Fold(rows).Other);

        Assert.Equal([new TimelineReport.Segment(4, Day(-4), null)], other.Segments);
    }

    [Fact]
    public void Fold_OtherHull_OnATieOfStarts_TakesTheStatusOfTheFirstSegmentInTreeOrder()
    {
        // Root 2 ranks before root 1, so its subtree is met first; inside it the parent comes before its child.
        var rows = new[]
        {
            Issue(1, "story", 4, Day(-2), rank: 2),
            Issue(2, "story", 3, Day(-2), rank: 1),
            Issue(3, "task", 4, Day(-2), parent: 2),
        };

        var other = Assert.IsType<TimelineReport.Node>(Fold(rows).Other);

        Assert.Equal([new TimelineReport.Segment(3, Day(-2), null)], other.Segments);
    }

    [Fact]
    public void Fold_OtherChildren_AreInRankOrder_ThenId()
    {
        var rows = new[]
        {
            Issue(1, "story", 3, Day(-1), rank: 30),
            Issue(2, "story", 3, Day(-1), rank: 10),
            Issue(4, "story", 3, Day(-1), rank: 20),
            Issue(3, "story", 3, Day(-1), rank: 20),
        };

        var other = Assert.IsType<TimelineReport.Node>(Fold(rows).Other);

        Assert.Equal<long?[]>([2, 3, 4, 1], Ids(other.Children));
    }

    [Fact]
    public void Fold_AnEpicBelowALooseRoot_IsDrawnAsAnEpicOnly_AndItsSegmentsDoNotFeedTheHull()
    {
        var rows = new[]
        {
            Issue(1, "story", 3, Day(-1)),
            Issue(2, "epic", 3, Day(-3), parent: 1),
        };

        var result = Fold(rows);

        Assert.Equal<long?[]>([2], Ids(result.Epics));
        var other = Assert.IsType<TimelineReport.Node>(result.Other);
        var story = Assert.Single(other.Children);
        Assert.Equal(1, story.IssueId);
        Assert.Empty(story.Children);
        Assert.Equal([new TimelineReport.Segment(3, Day(-1), null)], other.Segments);
    }

    [Fact]
    public void Fold_OtherNarrowsItsRootsByProjectAndCreator_WhileDescendantsRideRegardless()
    {
        var rows = new[]
        {
            Issue(1, "story", 1, Day(-10), project: 1, by: "ann"),
            Issue(2, "story", 1, Day(-10), project: 2, by: "bob"),
            Issue(3, "task", 3, Day(-3), parent: 1, project: 2, by: "bob"),
            Issue(4, "task", 4, Day(-4), parent: 2, project: 1, by: "ann"),
        };

        var byProject = Assert.IsType<TimelineReport.Node>(Fold(rows, projectId: 1).Other);
        Assert.Equal<long?[]>([1], Ids(byProject.Children));
        Assert.Equal<long?[]>([3], Ids(byProject.Children[0].Children));
        Assert.Equal([new TimelineReport.Segment(3, Day(-3), null)], byProject.Segments);

        var byCreator = Assert.IsType<TimelineReport.Node>(Fold(rows, createdBy: "bob").Other);
        Assert.Equal<long?[]>([2], Ids(byCreator.Children));
        Assert.Equal<long?[]>([4], Ids(byCreator.Children[0].Children));
        Assert.Equal([new TimelineReport.Segment(4, Day(-4), null)], byCreator.Segments);

        Assert.Null(Fold(rows, projectId: 2, createdBy: "ann").Other);
    }
}

/// <summary>
/// The route over the fold: the range it resolves, and what it refuses. The
/// fold's own rules are pinned in <see cref="TimelineReportTests"/>.
/// </summary>
public class TimelineReportControllerTests
{
    private static readonly DateTimeOffset Now = new(2026, 1, 31, 12, 0, 0, TimeSpan.Zero);

    private static readonly TimeSpan Ninety = TimeSpan.FromDays(90);

    private sealed class Harness
    {
        public required ReportsController Reports { get; init; }
        public required int ProjectId { get; init; }
    }

    /// <summary>One project, and a board of five columns: first, two active, terminal, deferred.</summary>
    private static async Task<Harness> NewAsync()
    {
        var db = new HatchContext(
            new DbContextOptionsBuilder<HatchContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

        var project = new EfHatchProject { Key = "AER", Name = "Hatch", CreatedAt = Now };
        db.AddRange(
            project,
            new EfHatchStatus { Name = "backlog", SortOrder = 10 },
            new EfHatchStatus { Name = "todo", SortOrder = 20 },
            new EfHatchStatus { Name = "doing", SortOrder = 30 },
            new EfHatchStatus { Name = "done", SortOrder = 40, IsTerminal = true },
            new EfHatchStatus { Name = "parked", SortOrder = 50, IsDeferred = true });
        await db.SaveChangesAsync();

        return new Harness
        {
            Reports = new ReportsController(
                db, new StubActorDirectory(), TestClaims.With(), new FakeTimeProvider(Now)),
            ProjectId = project.Id,
        };
    }

    private static T Value<T>(ActionResult<T> result) =>
        result.Value ?? throw new InvalidOperationException($"expected a value, got {result.Result?.GetType().Name ?? "nothing"}");

    private static string Refusal<T>(ActionResult<T> result) =>
        Assert.IsType<string>(Assert.IsType<BadRequestObjectResult>(result.Result).Value);

    [Fact]
    public async Task NoRange_IsTheNinetyDaysEndingNow()
    {
        var h = await NewAsync();

        var timeline = Value(await h.Reports.GetTimeline(null, null, null, null, default));

        Assert.Equal(Now, timeline.To);
        Assert.Equal(Now - Ninety, timeline.From);
    }

    [Fact]
    public async Task FromOnly_EndsNow()
    {
        var h = await NewAsync();
        var from = Now.AddDays(-5);

        var timeline = Value(await h.Reports.GetTimeline(from.ToString("O"), null, null, null, default));

        Assert.Equal(from, timeline.From);
        Assert.Equal(Now, timeline.To);
    }

    [Fact]
    public async Task ToOnly_BeginsNinetyDaysBeforeIt()
    {
        var h = await NewAsync();
        var to = Now.AddDays(-10);

        var timeline = Value(await h.Reports.GetTimeline(null, to.ToString("O"), null, null, default));

        Assert.Equal(to, timeline.To);
        Assert.Equal(to - Ninety, timeline.From);
    }

    [Fact]
    public async Task AnInvertedRange_IsRefused()
    {
        var h = await NewAsync();

        var result = await h.Reports.GetTimeline(Now.ToString("O"), Now.AddDays(-1).ToString("O"), null, null, default);

        Assert.Equal("a range ends before it begins", Refusal(result));
    }

    [Theory]
    [InlineData("yesterday", null)]
    [InlineData(null, "next week")]
    public async Task AnUnparseableBound_IsRefusedByName(string? from, string? to)
    {
        var h = await NewAsync();

        var result = await h.Reports.GetTimeline(from, to, null, null, default);

        Assert.Equal(RangeBounds.NotAnInstant(from ?? to), Refusal(result));
    }

    [Fact]
    public async Task AnEqualRange_IsLegalAndEmpty()
    {
        var h = await NewAsync();
        var at = Now.ToString("O");

        var timeline = Value(await h.Reports.GetTimeline(at, at, null, null, default));

        Assert.Equal(Now, timeline.From);
        Assert.Equal(Now, timeline.To);
        Assert.Empty(timeline.Epics);
        Assert.Null(timeline.Other);
    }

    [Fact]
    public async Task AnUnknownProject_IsRefusedByNumber()
    {
        var h = await NewAsync();

        var result = await h.Reports.GetTimeline(null, null, 999, null, default);

        Assert.Equal("there is no project 999", Refusal(result));
    }

    [Fact]
    public async Task AKnownProject_IsNotRefused()
    {
        var h = await NewAsync();

        var timeline = Value(await h.Reports.GetTimeline(null, null, h.ProjectId, null, default));

        Assert.Empty(timeline.Epics);
    }
}
