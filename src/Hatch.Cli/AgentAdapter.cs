using System.Diagnostics;

namespace Hatch.Cli;

/// <summary>
/// One playbook's own CLI, behind an interface general enough that the runner,
/// the hooks, and the usage probe can all be built without a caller naming
/// which agent it is.
/// </summary>
public interface IAgentAdapter
{
    /// <summary>The playbook's own word for this agent, e.g. "claude".</summary>
    string Id { get; }

    /// <summary>What a person reads where <see cref="Id"/> would read as code.</summary>
    string DisplayName { get; }

    /// <summary>
    /// Whether there is anything to spawn, and the sentence saying why not.
    /// Asked before a claim is taken: an increment that cannot start should not
    /// take a ticket off the board to find that out.
    /// </summary>
    bool CanSpawn(out string refusal);

    /// <summary>The unattended spawn - stdout read by a caller, stdin closed once the prompt is written.</summary>
    ProcessStartInfo BuildHeadless(SessionRequest request);

    /// <summary>The attached spawn - stdio left to whoever is at the keyboard.</summary>
    ProcessStartInfo BuildAttached(SessionRequest request);

    /// <summary>The reader that turns this agent's own stream into lines and the facts a caller needs out of it.</summary>
    IAgentStreamReader CreateReader(string root, RunFacts facts);

    /// <summary>The prose a quiet run ended with, out of the one object it answers with.</summary>
    string? ReadClosing(string json);

    /// <summary>What rejoins a session by its id, the way a person would type it.</summary>
    string ResumeCommand(string sessionId);

    /// <summary>
    /// The hooks that carry a message sent while a session works into its
    /// context, or null where none could be written - a session without them
    /// still works its ticket, a message sent mid-run waits for the next one.
    /// </summary>
    IAgentHooks? WriteHooks(string temp, string key, string hatch, string? rtk);

    /// <summary>The shape a hook call answers with, for this agent.</summary>
    IHookOutputWriter HookOutput { get; }

    /// <summary>Whether a session ended on this agent's own usage limit, read out of what it said rather than an API.</summary>
    UsageLimit.Recognised? RecogniseLimit(string? said, DateTimeOffset endedAt, TimeZoneInfo? runnerZone = null);

    /// <summary>Asked between sessions for the account's own usage windows, or null where this agent has none to ask.</summary>
    IUsageProbe? Probe { get; }
}

/// <summary>One session's stream, read back as terminal lines and the facts a caller needs out of it.</summary>
public interface IAgentStreamReader
{
    /// <summary>The lines one event turns into, in order. Empty for an event that draws nothing.</summary>
    IEnumerable<string> Read(string raw);

    /// <summary>The four counts added up, over every message seen so far in this session.</summary>
    long TokensSoFar { get; }

    /// <summary>One request per distinct message seen so far.</summary>
    int Requests { get; }

    /// <summary>The largest context carried by any one message so far.</summary>
    long PeakContextTokens { get; }

    /// <summary>The account's usage windows, out of the stream's own report - empty before the first one arrives.</summary>
    IReadOnlyList<UsageWindow> Usage { get; }

    /// <summary>When <see cref="Usage"/> was last taken.</summary>
    DateTimeOffset? UsageReadAt { get; }
}

/// <summary>The hooks a session was handed, and the directory outside every checkout that they live in.</summary>
public interface IAgentHooks : IDisposable
{
    /// <summary>The file whose modification time is when a per-step check last asked.</summary>
    string Stamp { get; }

    /// <summary>The fact record written once a session's tokens cross its playbook's budget.</summary>
    string Clamp { get; }

    /// <summary>The playbook's budget, in tokens, written once before a session starts.</summary>
    string Budget { get; }

    /// <summary>Touched the first time a session is told its budget was crossed, and never reset.</summary>
    string ClampDelivered { get; }

    /// <summary>
    /// Whatever this agent's own spawn needs back out of the hooks it was
    /// handed - a settings-file path for Claude's, null where an agent needs
    /// nothing more.
    /// </summary>
    string? Opaque { get; }
}

/// <summary>The shape a hook call answers with, so a session already mid-step reads what is waiting.</summary>
public interface IHookOutputWriter
{
    /// <summary>What a <c>Stop</c> hook prints to keep a session going long enough to read <paramref name="text"/>.</summary>
    string WriteStop(string text);

    /// <summary>What a <c>PostToolUse</c> hook prints to put <paramref name="text"/> in front of the model at its next step.</summary>
    string WritePostToolUse(string text);
}
