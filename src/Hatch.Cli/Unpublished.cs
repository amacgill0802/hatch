namespace Hatch.Cli;

/// <summary>
/// The guard that refuses to count an increment finished when it leaves a
/// branch on origin with no pull request recorded, for a ticket sitting in
/// the review column - see HA-214 for the five sessions that pushed code
/// nobody could find a review for. On a trunk-landing project there is never
/// a pull request to find (<see cref="Lifecycle.LeaveAsync"/> forces one
/// false there), so the same guard is judged by a recorded landing instead -
/// see <c>trunkLanding</c> below. Escalates exactly the way <see
/// cref="Increment.FlagStallAsync"/> does, and for the same reason: the first
/// occurrence in a row is let go of quietly, because most of the time
/// somebody simply has not opened the pull request - or recorded the landing
/// - yet, and the second is worth a person's eye.
/// </summary>
/// <remarks>
/// Never an <see cref="Increment"/> stall: the ticket moved, or its conflict
/// resolved, or its build pushed a fix - something happened, and the trouble
/// is that nobody can find it. The two guards are mutually exclusive by the
/// condition each is reached under, and neither touches the issue's status -
/// only <see cref="IncrementReport.ReleaseOutcome"/> changes, so the claim
/// counts the increment as not having finished cleanly.
/// </remarks>
public static class Unpublished
{
    /// <summary>
    /// This question's own label pair - never a stall, which marks itself and
    /// resumes unattended after a while. Nothing here knows whether a pull
    /// request is actually unnecessary, so this condition must not clear
    /// itself the same way: it waits for a person, however long that takes.
    /// </summary>
    public const string Recorded = "pull request recorded";
    public const string NotNeeded = "no pull request needed for this ticket";

    /// <summary>The same pair, worded for a trunk-landing project.</summary>
    public const string Landed = "landing recorded";
    public const string LandingNotNeeded = "no landing needed for this ticket";

    private static IReadOnlyList<QuestionOptionDto> Options(bool trunkLanding) =>
        trunkLanding
            ? [
                new(Landed, "Record it with hatch landed, or say it is already set - this comment does not record one for you."),
                new(LandingNotNeeded, "This ticket's work is not meant to land on its own."),
              ]
            : [
                new(Recorded, "Open it with hatch pr, or say it is already set - this comment does not record one for you."),
                new(NotNeeded, "This ticket's branch is not meant to go through a pull request."),
              ];

    /// <summary>
    /// Writes the one comment - and, on the second occurrence in a row, the
    /// question beside it - and answers with what the claim should be
    /// released with: always <see cref="ClaimOutcomes.Dropped"/>, because an
    /// increment that pushed code nobody can find a review for - or a landing
    /// nobody can find - has not finished, whatever else it did.
    /// </summary>
    public static async Task<string> RefuseAsync(
        Board board, Terminal say, IncrementReport report, IReadOnlyList<BranchEntry> branches, int letGo, bool trunkLanding, CancellationToken ct)
    {
        string body;
        if (trunkLanding)
        {
            body = $"""
                An unattended increment left {report.Key} in "{report.Ended}" with no landing recorded.
                Once the work is on the trunk, hatch landed {report.Key} <sha> records it, for each
                repository it touched.
                """;
        }
        else
        {
            var named = branches
                .Select(b => (b.Path, Branch: b.Kind == BranchKind.Entered ? b.Branch : b.Cut))
                .Where(b => b.Branch is { Length: > 0 })
                .ToList();
            var multiple = named.Count > 1;

            var where = named.Count == 0
                ? "a branch on origin"
                : string.Join('\n', named.Select(b =>
                    $"- {(multiple ? $"{Path.GetFileName(b.Path.TrimEnd('/', '\\'))}: " : "")}{b.Branch}"));

            body = $"""
                An unattended increment left {report.Key} in "{report.Ended}" with no pull request recorded
                for the branch it pushed:

                {where}
                """;
        }

        if (letGo > 0)
            body += $"\n\nThis is the {Increment.Ordinal(letGo + 1)} increment in a row to leave this ticket here "
                   + (trunkLanding ? "with no landing recorded." : "without one.");

        body += report.SessionId is { Length: > 0 } session
            ? $"\n\nThe session it ran in is still there, with everything it did in context:\n\n    claude --resume {session}"
            : "\n\nThere is no session to resume: the run ended before it said what its id was.";

        var situation = trunkLanding ? "left no landing recorded" : "left a branch on origin with no pull request";

        say.Line("");
        if (letGo > 0)
        {
            body += trunkLanding
                ? "\n\nA question goes up with this comment, so nothing further will be dispatched at\n"
                  + "this issue until somebody answers it. Answering it does not itself record a\n"
                  + "landing - that is still hatch landed - it only unblocks the next pass."
                : "\n\nA question goes up with this comment, so nothing further will be dispatched at\n"
                  + "this issue until somebody answers it. Answering it does not itself open or record a\n"
                  + "pull request - that is still hatch pr - it only unblocks the next pass.";
            say.Line($"hatch: {report.Key} {situation} - flagging it, and going on to the next");
        }
        else
        {
            say.Line($"hatch: {report.Key} {situation} - noted, and going on to the next");
        }

        say.Line("");

        try
        {
            await board.CommentAsync(report.Key, body, ct);

            if (letGo > 0)
                await board.AskAsync(
                    report.Key,
                    trunkLanding
                        ? $"{report.Key} has no landing recorded, sitting in \"{report.Ended}\" - has the work landed on the trunk?"
                        : $"{report.Key} has a branch on origin with no pull request recorded, sitting in \"{report.Ended}\" - has one been opened?",
                    Options(trunkLanding),
                    ct);

            var missing = trunkLanding ? "no landing recorded" : "no pull request recorded";
            report.Flag = letGo > 0 ? $"flagged - {missing}" : missing;
        }
        catch (Exception e) when (e is HatchException or OperationCanceledException)
        {
            report.Flag = "not flagged - the write was refused";
            say.Complain($"hatch: {report.Key} could not be flagged for its missing {(trunkLanding ? "landing" : "pull request")} - a later pass may offer it again");
        }

        return ClaimOutcomes.Dropped;
    }
}
