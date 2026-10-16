namespace Hatch.Cli.Tests;

/// <summary>
/// The one-pr line <c>show</c> prints - whether a story's tasks share its
/// branch and one pull request, and where the value comes from.
/// </summary>
public sealed class ShowOnePrTests
{
    private static IssueDto AStory(string key = "AER-5", bool onePr = false, bool? own = null, string? from = null) =>
        Fixtures.Issue(key, type: "story") with { OnePr = onePr, OnePrOwn = own, OnePrFrom = from };

    [Fact]
    public void It_says_whether_the_value_was_set_on_the_story_or_came_from_elsewhere()
    {
        Assert.Equal("one-pr:   on (set on this story)", IssueCommands.OnePrLine(AStory(onePr: true, own: true)));
        Assert.Equal("one-pr:   off (set on this story)", IssueCommands.OnePrLine(AStory(onePr: false, own: false)));
        Assert.Equal("one-pr:   off (the project's default)", IssueCommands.OnePrLine(AStory()));
        Assert.Equal(
            "one-pr:   on (inherited from AER-5)",
            IssueCommands.OnePrLine(Fixtures.Issue("AER-6") with { OnePr = true, OnePrFrom = "AER-5" }));
        Assert.Equal("one-pr:   off (not under a story)", IssueCommands.OnePrLine(Fixtures.Issue("AER-7")));
    }

    [Fact]
    public async Task Show_prints_the_line_where_it_is_on()
    {
        using var h = new CliHarness();
        h.Wire.Json("GET", "/api/hatch/issues/AER-6", Fixtures.Issue("AER-6") with { OnePr = true, OnePrFrom = "AER-5" });
        h.Wire.Json("GET", "/api/hatch/statuses", new[] { Fixtures.Status(3, "In Progress") });
        h.Wire.Json("GET", "/api/hatch/issues/AER-6/comments", Array.Empty<CommentDto>());

        await new IssueCommands(h.Cli).ShowAsync(["AER-6"], default);

        Assert.Contains("one-pr:   on (inherited from AER-5)", h.Said);
    }

    [Fact]
    public async Task Show_prints_the_line_for_a_story_told_off()
    {
        using var h = new CliHarness();
        h.Wire.Json("GET", "/api/hatch/issues/AER-5", AStory(onePr: false, own: false));
        h.Wire.Json("GET", "/api/hatch/statuses", new[] { Fixtures.Status(3, "In Progress") });
        h.Wire.Json("GET", "/api/hatch/issues/AER-5/comments", Array.Empty<CommentDto>());

        await new IssueCommands(h.Cli).ShowAsync(["AER-5"], default);

        Assert.Contains("one-pr:   off (set on this story)", h.Said);
    }

    [Fact]
    public async Task Show_says_nothing_of_it_where_nobody_turned_it_on()
    {
        using var h = new CliHarness();
        h.Wire.Json("GET", "/api/hatch/issues/AER-5", AStory());
        h.Wire.Json("GET", "/api/hatch/statuses", new[] { Fixtures.Status(3, "In Progress") });
        h.Wire.Json("GET", "/api/hatch/issues/AER-5/comments", Array.Empty<CommentDto>());

        await new IssueCommands(h.Cli).ShowAsync(["AER-5"], default);

        Assert.DoesNotContain("one-pr", h.Said);
    }
}
