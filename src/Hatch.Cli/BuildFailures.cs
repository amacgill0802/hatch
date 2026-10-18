namespace Hatch.Cli;

/// <summary>
/// Whether a failing check's log reads as the kind a re-run fixes, not the kind
/// a person has to. Pure over the excerpt text alone - no git, no forge, no
/// board - so a re-run decision is testable with strings.
/// </summary>
public static class BuildFailures
{
    // One place for the patterns, conservative by construction: a failure is
    // transient only when it matches one of these, never by default. Each
    // phrase is a fixed, multi-word string chosen to avoid an incidental match
    // on a bare number or word a log could carry for an unrelated reason.
    private static readonly (string Label, string[] Phrases)[] Patterns =
    [
        // A package registry or host the build reached out to was unreachable.
        ("network", ["getaddrinfo enotfound", "econnreset", "econnrefused", "etimedout", "eai_again", "temporary failure in name resolution", "could not resolve host"]),
        // The registry or forge throttled the request.
        ("rate-limit", ["429 too many requests", "too many requests", "rate limit exceeded", "secondary rate limit"]),
        // The registry or forge itself was down or erroring.
        ("5xx", ["bad gateway", "service unavailable", "gateway timeout", "internal server error"]),
        // The forge lost or cancelled the runner mid-job, through no fault of the build.
        ("runner-lost", ["lost communication with the server", "runner has received a shutdown signal"]),
        // A step or job ran past its own time limit.
        ("timeout", ["has exceeded the maximum execution time", "has timed out after"]),
    ];

    /// <summary>
    /// True where <paramref name="excerpt"/> matches one of the patterns above -
    /// false for every other input, including null, empty or whitespace: a
    /// failure with no log to read is not transient, because there is nothing
    /// to have recognised.
    /// </summary>
    public static bool IsTransient(string? excerpt) =>
        !string.IsNullOrWhiteSpace(excerpt)
        && Patterns.Any(p => p.Phrases.Any(phrase => excerpt.Contains(phrase, StringComparison.OrdinalIgnoreCase)));
}
