namespace Hatch.Cli.Tests;

/// <summary>Resolving an arbitrary sha against the trunk, against real git.</summary>
public sealed class WorkspaceResolveOnTrunkTests : RepoFixture
{
    [Fact]
    public void A_sha_that_is_the_trunks_own_tip_resolves_on_the_trunk()
    {
        var full = G(_work, "rev-parse", "HEAD").Trim();

        var (resolved, onTrunk) = Ws().ResolveOnTrunk(full, "main");

        Assert.Equal(full, resolved);
        Assert.True(onTrunk);
    }

    [Fact]
    public void A_sha_committed_on_a_branch_never_merged_to_the_trunk_is_not_on_it()
    {
        G(_work, "checkout", "--quiet", "-b", "other");
        File.WriteAllText(Path.Combine(_work, "other.txt"), "other");
        Commit(_work, "Not on the trunk");
        var full = G(_work, "rev-parse", "HEAD").Trim();

        var (resolved, onTrunk) = Ws().ResolveOnTrunk(full, "main");

        Assert.Equal(full, resolved);
        Assert.False(onTrunk);
    }

    [Fact]
    public void A_string_that_is_not_a_valid_ref_does_not_resolve()
    {
        var (resolved, onTrunk) = Ws().ResolveOnTrunk("not-a-sha", "main");

        Assert.Null(resolved);
        Assert.False(onTrunk);
    }
}
