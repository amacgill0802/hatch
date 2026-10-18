namespace Hatch.Cli.Tests;

/// <summary>
/// <see cref="BuildFailures.IsTransient"/> is a pure function over the
/// excerpt text alone, so it is tested with strings and no forge.
/// </summary>
public sealed class BuildFailuresTests
{
    // ---- IsTransient ----

    [Fact]
    public void A_network_failure_reaching_a_package_registry_is_transient()
    {
        Assert.True(BuildFailures.IsTransient(
            "npm ERR! network request to https://registry.npmjs.org/left-pad failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org"));
    }

    [Fact]
    public void A_rate_limit_is_transient()
    {
        Assert.True(BuildFailures.IsTransient("##[error]API rate limit exceeded for installation ID 123456."));
    }

    [Fact]
    public void A_registry_5xx_is_transient()
    {
        Assert.True(BuildFailures.IsTransient("npm ERR! 500 Internal Server Error - GET https://registry.npmjs.org/left-pad"));
    }

    [Fact]
    public void A_runner_the_forge_lost_or_cancelled_is_transient()
    {
        Assert.True(BuildFailures.IsTransient(
            "##[error]The runner has received a shutdown signal. This can happen when the runner service is stopped, or a manually started runner is cancelled."));
    }

    [Fact]
    public void A_step_that_timed_out_is_transient()
    {
        Assert.True(BuildFailures.IsTransient(
            "##[error]The job running on runner GitHub Actions 2 has exceeded the maximum execution time of 60 minutes."));
    }

    [Fact]
    public void A_compile_error_is_not_transient()
    {
        Assert.False(BuildFailures.IsTransient("Program.cs(10,5): error CS1002: ; expected"));
    }

    [Fact]
    public void A_failing_test_is_not_transient()
    {
        Assert.False(BuildFailures.IsTransient("Assert.Equal() Failure\nExpected: 1\nActual: 2\n   at MyTests.Test1() in /src/MyTests.cs:line 10"));
    }

    [Fact]
    public void A_lint_violation_is_not_transient()
    {
        Assert.False(BuildFailures.IsTransient("src/app.ts:4:1  error  Missing semicolon  semi"));
    }

    [Fact]
    public void A_null_excerpt_is_not_transient()
    {
        Assert.False(BuildFailures.IsTransient(null));
    }

    [Fact]
    public void An_empty_or_whitespace_excerpt_is_not_transient()
    {
        Assert.False(BuildFailures.IsTransient(""));
        Assert.False(BuildFailures.IsTransient("   "));
    }
}
