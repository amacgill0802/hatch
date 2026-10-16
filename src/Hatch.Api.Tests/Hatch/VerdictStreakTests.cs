using Hatch.Api.Modules.Hatch;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// <see cref="VerdictStreak.Count"/> measured off hand-built event tuples - no
/// <see cref="HatchContext"/> needed, the way <see cref="ColumnsTests"/> tests a
/// static helper with no rows of its own.
/// </summary>
public class VerdictStreakTests
{
    const int PlaybookId = 7;
    const int OtherPlaybookId = 9;

    static (string Kind, string? Payload) Fail(int playbookId = PlaybookId) =>
        (EfHatchIssueEvent.StatusChanged, $"{{\"verdict\":\"fail\",\"playbookId\":{playbookId}}}");

    static (string Kind, string? Payload) Pass(int playbookId = PlaybookId) =>
        (EfHatchIssueEvent.StatusChanged, $"{{\"verdict\":\"pass\",\"playbookId\":{playbookId}}}");

    static (string Kind, string? Payload) Advance() =>
        (EfHatchIssueEvent.StatusChanged, "{\"from\":\"To Do\",\"to\":\"Checking\"}");

    static (string Kind, string? Payload) AnsweredEvent() =>
        (EfHatchIssueEvent.Answered, null);

    [Fact]
    public void EmptyTrail_CountsZero()
    {
        Assert.Equal(0, VerdictStreak.Count([], PlaybookId));
    }

    [Fact]
    public void FailsInARow_SamePlaybook_CountEachOne()
    {
        var trail = new[] { Fail(), Fail(), Fail() };

        Assert.Equal(3, VerdictStreak.Count(trail, PlaybookId));
    }

    [Fact]
    public void PassForSamePlaybook_StopsTheCountAtTheFailsAboveIt()
    {
        var trail = new[] { Fail(), Fail(), Pass() };

        Assert.Equal(2, VerdictStreak.Count(trail, PlaybookId));
    }

    [Fact]
    public void AnsweredEvent_StopsTheCount_EvenDirectlyAboveARunOfFails()
    {
        var trail = new[] { Fail(), Fail(), AnsweredEvent(), Fail(), Fail() };

        Assert.Equal(2, VerdictStreak.Count(trail, PlaybookId));
    }

    [Fact]
    public void StatusChangedWithNoVerdict_IsSkipped_NeitherBreaksNorCounts()
    {
        var trail = new[] { Fail(), Advance(), Fail() };

        Assert.Equal(2, VerdictStreak.Count(trail, PlaybookId));
    }

    [Fact]
    public void StatusChangedForADifferentPlaybook_BreaksTheCount_WithoutCounting()
    {
        var trail = new[] { Fail(), Fail(playbookId: OtherPlaybookId), Fail() };

        Assert.Equal(1, VerdictStreak.Count(trail, PlaybookId));
    }
}
