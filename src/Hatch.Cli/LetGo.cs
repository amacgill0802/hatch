namespace Hatch.Cli;

/// <summary>
/// The comments written when a ticket comes back to the board without having
/// moved - a runner that fell over partway through an increment (HA-115), or
/// an increment that ran to the end and simply did not move it (HA-118). Two
/// methods and not one, because the two say different things happened, but
/// both read as the same kind of sentence: what let go of the ticket, and why.
/// </summary>
public static class LetGo
{
    /// <summary>
    /// The runner itself fell over - picking, claiming, the tree, the session,
    /// or tidying up after it - rather than the increment running to an
    /// ordinary end. Best-effort: a ticket whose flag could not be written is
    /// still let go of, and the runner says why on its own output instead of
    /// failing a second time over the same comment.
    /// </summary>
    public static Task CommentAsync(
        Board board, Terminal say, IAgentAdapter adapter, string key, string why, string? sessionId,
        CancellationToken ct) =>
        WriteAsync(
            board, say, adapter, key, $"An unattended runner failed and let {key} go: {why}.",
            sessionId, "No session had started when it failed.", ct);

    /// <summary>
    /// The increment ran to the end and still left the ticket where it found
    /// it - the first time in a row that happens, which costs one quiet
    /// comment rather than a flag: see <see cref="Increment"/>'s stall guard
    /// for why a second one in a row is treated differently. <paramref name="untouched"/>
    /// is false when the board shows the ticket moved or gained children anyway,
    /// under a session whose own account cannot be trusted: the opening then
    /// does not claim it was left where it was found.
    /// </summary>
    public static Task LeftAsync(
        Board board, Terminal say, IAgentAdapter adapter, string key, string why, string? sessionId,
        CancellationToken ct, bool untouched = true) =>
        WriteAsync(
            board, say, adapter, key,
            untouched
                ? $"An unattended increment left {key} where it found it and let it go: {why}."
                : $"An unattended increment worked on {key}, but its account of that cannot be trusted, and let {key} go: {why}.",
            sessionId, "There is no session to resume: the run ended before it said what its id was.", ct);

    private static async Task WriteAsync(
        Board board, Terminal say, IAgentAdapter adapter, string key, string opening, string? sessionId,
        string noSession, CancellationToken ct)
    {
        var body = opening;

        body += sessionId is { Length: > 0 } session
            ? $"\n\nThe session it ran in is still there, with everything it did in context:\n\n    {adapter.ResumeCommand(session)}"
            : $"\n\n{noSession}";

        try
        {
            await board.CommentAsync(key, body, ct);
        }
        catch (Exception e) when (e is HatchException or OperationCanceledException)
        {
            say.Complain($"hatch: {key} could not be told it was let go - {e.Message}");
        }
    }
}
