using Hatch.Api.Modules.Hatch;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// <see cref="LandingWork"/> measured off hand-built rows - no
/// <see cref="HatchContext"/> needed, the way <see cref="MergeWorkTests"/> is.
/// </summary>
public class LandingWorkTests
{
    static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;

    const string Remote = "https://example.com/o/r";
    const string Other = "https://example.com/o/s";
    static readonly string Sha = new('a', 40);
    static readonly string Newer = new('b', 40);

    static EfHatchProjectRepository Repo(string remote = Remote) =>
        new() { Remote = remote, Canonical = RemoteIdentity.Canonical(remote).Item1!, SortOrder = 0, CreatedAt = Now };

    static EfHatchLanding Landing(string remote, string sha, string? containedBy) => new()
    {
        Remote = remote, Canonical = RemoteIdentity.Canonical(remote).Item1!, Trunk = "main", Sha = sha,
        ContainedBy = containedBy, RecordedAt = Now, RecordedBy = "runner",
    };

    static EfHatchTrunkBuild Trunk(string remote, string verdict, string sha, DateTimeOffset shaSince) => new()
    {
        Remote = remote, Canonical = RemoteIdentity.Canonical(remote).Item1!, Trunk = "main", Sha = sha,
        ShaSince = shaSince, Verdict = verdict, CheckedAt = Now, Runner = "host:/checkout", CheckedBy = "runner",
    };

    static MergeWork.Judgement Judge(
        EfHatchLanding[] landings, EfHatchTrunkBuild[] builds, bool checksRequired = true, EfHatchProjectRepository[]? bound = null) =>
        LandingWork.Judge(bound ?? [Repo(Remote)], landings, builds, checksRequired, Now);

    [Fact]
    public void NoLanding_Pending()
    {
        var j = Judge([], []);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("no landing is recorded for it yet", j.Sentence);
    }

    [Fact]
    public void LandingNotYetSeenOnTrunk_Pending()
    {
        var j = Judge([Landing(Remote, Sha, null)], []);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("no runner has seen aaaaaaa on main yet", j.Sentence);
    }

    [Fact]
    public void NoBuild_Pending()
    {
        var j = Judge([Landing(Remote, Sha, Sha)], []);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("no runner has read main's build on aaaaaaa yet", j.Sentence);
    }

    [Fact]
    public void BuildOnAnotherSha_IsUnreadNotPassed()
    {
        var j = Judge([Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.Passed, Newer, Now)]);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("no runner has read main's build on aaaaaaa yet", j.Sentence);
    }

    [Fact]
    public void FailedBuild_Holds()
    {
        var j = Judge([Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.Failed, Sha, Now)]);

        Assert.Equal(WorkKinds.Hold, j.Kind);
        Assert.Equal("main's build on aaaaaaa failed after it landed", j.Sentence);
    }

    [Fact]
    public void RunningBuild_Pending()
    {
        var j = Judge([Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.Pending, Sha, Now)]);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("main's build on aaaaaaa is still running", j.Sentence);
    }

    [Fact]
    public void PassedBuild_Lands()
    {
        var j = Judge([Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.Passed, Sha, Now)]);

        Assert.Equal(WorkKinds.Land, j.Kind);
        Assert.Equal("it is on main at aaaaaaa and the trunk's build passes", j.Sentence);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void NoChecksInsideTheWindow_Pending(bool checksRequired)
    {
        var j = Judge([Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.None, Sha, Now - TimeSpan.FromMinutes(1))], checksRequired);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("no checks have run on main at aaaaaaa yet", j.Sentence);
    }

    [Fact]
    public void NoChecksPastTheWindow_HoldsWhereChecksAreRequired()
    {
        var j = Judge([Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.None, Sha, Now - MergeWork.SettleWindow)], checksRequired: true);

        Assert.Equal(WorkKinds.Hold, j.Kind);
        Assert.Equal("it is on main at aaaaaaa and no checks ran there", j.Sentence);
    }

    [Fact]
    public void NoChecksPastTheWindow_LandsWhereNoneAreRequired()
    {
        var j = Judge([Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.None, Sha, Now - MergeWork.SettleWindow)], checksRequired: false);

        Assert.Equal(WorkKinds.Land, j.Kind);
        Assert.Equal("it is on main at aaaaaaa, and this project requires no checks", j.Sentence);
    }

    [Fact]
    public void UnboundRepositorysLanding_IsIgnored()
    {
        var j = Judge([Landing(Other, Sha, null)], [], bound: [Repo(Remote)]);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("no landing is recorded for it yet", j.Sentence);
    }

    [Fact]
    public void ProjectBindingNothing_CountsEveryLanding()
    {
        var j = Judge([Landing(Other, Sha, null)], [], bound: []);

        Assert.Equal(WorkKinds.Pending, j.Kind);
        Assert.Equal("no runner has seen aaaaaaa on main yet", j.Sentence);
    }

    [Fact]
    public void TwoRepositories_OneFailed_HoldsNamingTheFailedOne()
    {
        var failedSha = Newer;
        var j = Judge(
            [Landing(Remote, Sha, Sha), Landing(Other, failedSha, failedSha)],
            [Trunk(Remote, BuildVerdicts.Passed, Sha, Now), Trunk(Other, BuildVerdicts.Failed, failedSha, Now)],
            bound: [Repo(Remote), Repo(Other)]);

        Assert.Equal(WorkKinds.Hold, j.Kind);
        Assert.Equal("main's build on bbbbbbb failed after it landed", j.Sentence);
    }

    [Fact]
    public void TwoRepositories_NamesTheFirstByCanonical()
    {
        var j = Judge(
            [Landing(Other, Newer, null), Landing(Remote, Sha, null)], [],
            bound: [Repo(Remote), Repo(Other)]);

        Assert.Equal("no runner has seen aaaaaaa on main yet", j.Sentence);
    }

    [Theory]
    [InlineData(Landings.Trunk, null, true)]
    [InlineData(Landings.Trunk, "https://example.com/o/r/pull/1", false)]
    [InlineData(Landings.PullRequest, null, false)]
    [InlineData(Landings.Trunk, "  ", true)]
    public void Applies_OnlyToATrunkProjectWithNoPullRequest(string landing, string? pullRequestUrl, bool expected)
    {
        Assert.Equal(expected, LandingWork.Applies(landing, pullRequestUrl));
        Assert.Equal(expected, LandingWork.Applies(new EfHatchIssue
        {
            Project = new EfHatchProject { Landing = landing, Key = "X", Name = "X", CreatedAt = Now },
            PullRequestUrl = pullRequestUrl,
            ProjectId = 1, Number = 1, Type = "task", Title = "t", StatusId = 0, Rank = 0, CreatedBy = "runner", CreatedAt = Now, UpdatedAt = Now,
        }));
    }

    [Fact]
    public void Comment_WhereTheBuildPassed()
    {
        var comment = LandingWork.Comment([Repo(Remote)], [Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.Passed, Sha, Now)]);

        Assert.Equal("Landed on main at aaaaaaa; the trunk's build passes.", comment);
    }

    [Fact]
    public void Comment_WhereNoChecksRan()
    {
        var comment = LandingWork.Comment([Repo(Remote)], [Landing(Remote, Sha, Sha)], [Trunk(Remote, BuildVerdicts.None, Sha, Now)]);

        Assert.Equal("Landed on main at aaaaaaa; this project requires no checks.", comment);
    }
}
