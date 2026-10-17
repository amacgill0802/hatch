namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// What a trunk-landing issue in review is waiting on, decided the way
/// <see cref="MergeWork"/> decides it for the merge column: from what runners
/// have reported. A trunk-landing issue has no pull request, so the question is
/// not whether its branch is clean but whether its commit is on the trunk and
/// the trunk's build passes there. Reuses <see cref="MergeWork.Judgement"/> and
/// <see cref="MergeWork.SettleWindow"/>.
/// </summary>
public static class LandingWork
{
    /// <summary>Whether the project lands on its trunk and the issue has no pull request.</summary>
    public static bool Applies(string projectLanding, string? pullRequestUrl) =>
        projectLanding == Landings.Trunk && string.IsNullOrWhiteSpace(pullRequestUrl);

    /// <summary>As <see cref="Applies(string, string?)"/>, for an issue with its <see cref="EfHatchIssue.Project"/> loaded.</summary>
    public static bool Applies(EfHatchIssue issue) => Applies(issue.Project!.Landing, issue.PullRequestUrl);

    /// <summary>The landings for repositories the project still binds - every one, if it binds none.</summary>
    public static IReadOnlyList<EfHatchLanding> Counted(
        IReadOnlyList<EfHatchProjectRepository> bound, IReadOnlyList<EfHatchLanding> landings) =>
        bound.Count == 0 ? landings : landings.Where(l => bound.Any(r => r.Canonical == l.Canonical)).ToList();

    public static MergeWork.Judgement Judge(
        IReadOnlyList<EfHatchProjectRepository> bound,
        IReadOnlyList<EfHatchLanding> landings,
        IReadOnlyList<EfHatchTrunkBuild> trunkBuilds,
        bool checksRequired,
        DateTimeOffset now)
    {
        var counted = Ordered(Counted(bound, landings));

        if (counted.Count == 0)
            return Pending("no landing is recorded for it yet");

        if (counted.FirstOrDefault(l => l.ContainedBy is null) is { } unseen)
            return Pending($"no runner has seen {Short(unseen.Sha)} on {unseen.Trunk} yet");

        var builds = counted.Select(l => new Landed(l, BuildOf(l, trunkBuilds))).ToList();

        if (builds.FirstOrDefault(b => b.Build is null || b.Build.Sha != b.Landing.ContainedBy) is { } unread)
            return Pending($"no runner has read {unread.Landing.Trunk}'s build on {Short(unread.Landing.ContainedBy)} yet");

        if (builds.FirstOrDefault(b => b.Build!.Verdict == BuildVerdicts.Failed) is { } failed)
            return Hold($"{failed.Landing.Trunk}'s build on {Short(failed.Landing.ContainedBy)} failed after it landed");

        if (builds.FirstOrDefault(b => b.Build!.Verdict == BuildVerdicts.Pending) is { } running)
            return Pending($"{running.Landing.Trunk}'s build on {Short(running.Landing.ContainedBy)} is still running");

        if (builds.All(b => b.Build!.Verdict == BuildVerdicts.Passed))
        {
            var first = counted[0];
            return new MergeWork.Judgement(WorkKinds.Land,
                $"it is on {first.Trunk} at {Short(first.ContainedBy)} and the trunk's build passes");
        }

        // What is left is a build that read none, alongside any that passed.
        var none = builds.Where(b => b.Build!.Verdict == BuildVerdicts.None).ToList();
        var landing = none[0].Landing;
        var where = $"{landing.Trunk} at {Short(landing.ContainedBy)}";

        if (none.All(b => now - b.Build!.ShaSince >= MergeWork.SettleWindow))
            return checksRequired
                ? Hold($"it is on {where} and no checks ran there")
                : new MergeWork.Judgement(WorkKinds.Land, $"it is on {where}, and this project requires no checks");

        return Pending($"no checks have run on {where} yet");
    }

    /// <summary>The sentence a route puts on the ticket when the board lands it, naming the first counted landing.</summary>
    public static string Comment(
        IReadOnlyList<EfHatchProjectRepository> bound,
        IReadOnlyList<EfHatchLanding> landings,
        IReadOnlyList<EfHatchTrunkBuild> trunkBuilds)
    {
        var counted = Ordered(Counted(bound, landings));
        var first = counted.FirstOrDefault();
        var where = $"{first?.Trunk ?? "the trunk"} at {Short(first?.ContainedBy ?? first?.Sha)}";

        var unchecked_ = counted.Any(l => BuildOf(l, trunkBuilds)?.Verdict == BuildVerdicts.None);
        return unchecked_
            ? $"Landed on {where}; this project requires no checks."
            : $"Landed on {where}; the trunk's build passes.";
    }

    /// <summary>A landing and the trunk build the board holds for it, if any. A class, so <c>FirstOrDefault</c> can say there is none.</summary>
    private sealed record Landed(EfHatchLanding Landing, EfHatchTrunkBuild? Build);

    private static List<EfHatchLanding> Ordered(IReadOnlyList<EfHatchLanding> landings) =>
        landings.OrderBy(l => l.Canonical, StringComparer.Ordinal).ToList();

    private static EfHatchTrunkBuild? BuildOf(EfHatchLanding landing, IReadOnlyList<EfHatchTrunkBuild> trunkBuilds) =>
        trunkBuilds.FirstOrDefault(b => b.Canonical == landing.Canonical && b.Trunk == landing.Trunk);

    private static MergeWork.Judgement Hold(string why) => new(WorkKinds.Hold, why);

    private static MergeWork.Judgement Pending(string why) => new(WorkKinds.Pending, why);

    private static string Short(string? sha) => sha is null ? "" : sha.Length > 7 ? sha[..7] : sha;
}
