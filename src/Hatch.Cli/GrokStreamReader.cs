using System.Diagnostics;
using System.Text.Json;

namespace Hatch.Cli;

/// <summary>
/// Grok Build's own event vocabulary, read back the way <see
/// cref="StreamRender"/> reads Claude's <c>stream-json</c> and <see
/// cref="CodexStreamReader"/> reads Codex's <c>--json</c> - its own file,
/// standalone from any adapter (none exists yet). Read against the vendor's
/// own headless-mode guide, 2026-10-19.
/// </summary>
/// <remarks>
/// <para><b>Session id.</b> Grok's <c>-s</c> demands a UUID before the stream
/// has said anything, so the constructor mints one eagerly (lower-case
/// hyphenated, <see cref="Guid.NewGuid"/>'s own format) rather than waiting
/// for an event the way <see cref="CodexStreamReader"/> waits for
/// <c>thread.started</c>. <c>end.sessionId</c>, or the quiet <c>json</c>
/// object's own, replaces it when it differs.</para>
///
/// <para><b>Tokens.</b> Only a dedicated <c>usage</c> event (or the quiet
/// <c>json</c> object's own top-level <c>usage</c>) drives <see
/// cref="TokensSoFar"/>, <see cref="Requests"/> and <see
/// cref="PeakContextTokens"/> - <c>end</c>'s own <c>usage</c> field is read
/// only for the work-log fallback row below, never added to these running
/// totals, since a real run's <c>usage</c> events already carried it. Total is
/// <c>input + output + cache_creation + cache_read</c>; peak context is the
/// same less output. A <c>usage</c> event is deduped by <c>messageId</c>;
/// counted unconditionally when it carries none, which is every line for the
/// quiet <c>json</c> object (a single call). <c>reasoning_tokens</c> is read
/// as already inside <c>output_tokens</c> - the vendor's own total leaves it
/// out - so it is never added again here.</para>
///
/// <para><b>The work-log row</b>, built on <c>end</c> or the quiet object: one
/// row per <c>modelUsage</c> key, or - missing or empty - one row keyed
/// <c>"grok"</c> carrying the top-level <c>usage</c>'s counts instead.</para>
///
/// <para><b>Cost.</b> <c>total_cost_usd_ticks / 10_000_000_000m</c> when
/// present (exact), else <c>total_cost_usd</c>, else null - unpriced, never
/// zero (HA-707). Never <c>?? 0m</c>, unlike <see cref="StreamRender"/>'s own
/// Claude reading.</para>
///
/// <para><b>The final message.</b> <c>text.data</c> accumulates into a buffer
/// cleared on every <c>tool_call</c> and <c>tool_call_update</c>, so what is
/// left at <c>end</c> is the text after the last tool - <see
/// cref="RunFacts.ResultText"/>, fed to <see cref="StreamRender.WorkLog"/> for
/// the fence. <see cref="RunFacts.LastAssistantText"/> is simply the latest
/// non-empty <c>text.data</c>, overwritten rather than accumulated.</para>
///
/// <para><b>Errors.</b> An <c>error</c> event's <c>message</c> becomes both
/// <see cref="RunFacts.ResultText"/> and <see
/// cref="RunFacts.LastAssistantText"/> directly - what <c>Increment</c>'s
/// usage-limit read looks at on a run that ends without <c>end</c>, which
/// leaves <see cref="RunFacts.Result"/> null. <c>IsError</c> is true once an
/// <c>error</c> was seen, or <c>stopReason</c> is anything but
/// <c>end_turn</c>.</para>
///
/// <para>This vocabulary has no rate-limit event, so <see cref="Usage"/> is
/// always empty and <see cref="UsageReadAt"/> always null - an absent battery
/// is already a supported state.</para>
/// </remarks>
internal sealed class GrokStreamReader : IAgentStreamReader
{
    private readonly RunFacts _facts;
    private readonly Stopwatch _stopwatch = Stopwatch.StartNew();
    private readonly HashSet<string> _counted = [];

    private string _buffer = "";
    private bool _sawError;
    private long _peakContext;

    internal GrokStreamReader(string root, RunFacts facts)
    {
        _facts = facts;
        _facts.SessionId = Guid.NewGuid().ToString();
    }

    public long TokensSoFar { get; private set; }

    public int Requests { get; private set; }

    public long PeakContextTokens => _peakContext;

    /// <summary>
    /// Always empty - this vocabulary carries no rate-limit event. See the
    /// class remarks.
    /// </summary>
    public IReadOnlyList<UsageWindow> Usage { get; } = [];

    public DateTimeOffset? UsageReadAt => null;

    /// <summary>
    /// Terminal drawing is out of scope for this reader - every case below
    /// returns no lines, and is filed as HA-936, which layers printed lines
    /// onto this same switch with no change to the facts logic here.
    /// </summary>
    public IEnumerable<string> Read(string raw)
    {
        var line = raw.TrimStart();
        if (!line.StartsWith('{')) return [];

        JsonElement e;
        try
        {
            e = JsonDocument.Parse(line).RootElement;
        }
        catch (JsonException)
        {
            return [];
        }

        var type = Text(e, "type");
        if (type is null)
            return e.TryGetProperty("sessionId", out _) ? QuietJson(e) : [];

        return type switch
        {
            "tool_call" or "tool_call_update" => ClearBuffer(),
            "text" => TextEvent(e),
            "usage" => UsageEvent(e),
            "end" => Finish(e),
            "error" => Error(e),
            _ => [],
        };
    }

    private IEnumerable<string> ClearBuffer()
    {
        _buffer = "";
        return [];
    }

    private IEnumerable<string> TextEvent(JsonElement e)
    {
        if (Text(e, "data") is { Length: > 0 } data)
        {
            _buffer += data;
            _facts.LastAssistantText = data;
        }

        return [];
    }

    private IEnumerable<string> UsageEvent(JsonElement e)
    {
        var messageId = Text(e, "messageId");
        if (messageId is not null && !_counted.Add(messageId)) return [];

        CountTokens(e);
        return [];
    }

    private void CountTokens(JsonElement e)
    {
        if (!e.TryGetProperty("usage", out var usage)) return;

        var input = Long(usage, "input_tokens");
        var output = Long(usage, "output_tokens");
        var cacheCreation = Long(usage, "cache_creation_input_tokens");
        var cacheRead = Long(usage, "cache_read_input_tokens");

        TokensSoFar += input + output + cacheCreation + cacheRead;
        Requests += 1;

        var context = input + cacheCreation + cacheRead;
        if (context > _peakContext) _peakContext = context;
    }

    private IEnumerable<string> Error(JsonElement e)
    {
        if (Text(e, "message") is { } message)
        {
            _facts.ResultText = message;
            _facts.LastAssistantText = message;
        }

        _sawError = true;
        return [];
    }

    /// <summary>
    /// The quiet run's single <c>json</c> object counts as both the one
    /// <c>usage</c> event a stream would have sent and the <c>end</c> that
    /// finishes it - its own top-level <c>usage</c> is read for the running
    /// totals here, since no separate <c>usage</c> event will ever arrive to
    /// do it.
    /// </summary>
    private IEnumerable<string> QuietJson(JsonElement e)
    {
        CountTokens(e);
        return Finish(e);
    }

    private IEnumerable<string> Finish(JsonElement e)
    {
        if (Text(e, "sessionId") is { Length: > 0 } id) _facts.SessionId = id;

        var resultText = Text(e, "text") ?? _buffer;
        _facts.ResultText = resultText;

        var stopReason = Text(e, "stopReason");
        var failed = _sawError || (stopReason is { Length: > 0 } && stopReason != "end_turn");

        var cost = Cost(e);
        if (cost is { } spent) _facts.CostUsd = spent;

        var (title, summary) = StreamRender.WorkLog(resultText);

        _facts.Result = new WorkLogEntryRequest(
            SessionId: _facts.SessionId ?? "",
            StartedAt: default,
            EndedAt: default,
            DurationMs: _stopwatch.ElapsedMilliseconds,
            Title: title,
            Summary: summary,
            IsError: failed,
            Turns: (int)Long(e, "num_turns"),
            CostUsd: cost,
            Models: Models(e));

        return [];
    }

    private static decimal? Cost(JsonElement e) =>
        Decimal(e, "total_cost_usd_ticks") is { } ticks ? ticks / 10_000_000_000m : Decimal(e, "total_cost_usd");

    /// <summary>
    /// One row per <c>modelUsage</c> key, Hatch's names rather than the
    /// vendor's - or, missing or empty, one row keyed <c>"grok"</c> carrying
    /// the top-level <c>usage</c>'s counts, so a run that never named a model
    /// still gets a work-log entry.
    /// </summary>
    private static List<WorkLogModelUseDto> Models(JsonElement e)
    {
        var models = new List<WorkLogModelUseDto>();

        if (e.TryGetProperty("modelUsage", out var modelUsage) && modelUsage.ValueKind == JsonValueKind.Object &&
            modelUsage.EnumerateObject().Any())
        {
            foreach (var model in modelUsage.EnumerateObject())
                models.Add(new WorkLogModelUseDto(
                    Model: model.Name,
                    InputTokens: Long(model.Value, "inputTokens"),
                    OutputTokens: Long(model.Value, "outputTokens"),
                    CacheCreationTokens: Long(model.Value, "cacheCreationInputTokens"),
                    CacheReadTokens: Long(model.Value, "cacheReadInputTokens"),
                    CostUsd: Decimal(model.Value, "costUSD")));

            return models;
        }

        if (e.TryGetProperty("usage", out var usage) && usage.ValueKind == JsonValueKind.Object)
            models.Add(new WorkLogModelUseDto(
                Model: "grok",
                InputTokens: Long(usage, "input_tokens"),
                OutputTokens: Long(usage, "output_tokens"),
                CacheCreationTokens: Long(usage, "cache_creation_input_tokens"),
                CacheReadTokens: Long(usage, "cache_read_input_tokens"),
                CostUsd: Cost(e)));

        return models;
    }

    /// <summary>The prose a quiet run ended with, for the adapter's <c>ReadClosing</c>.</summary>
    internal static string? Closing(string json)
    {
        try
        {
            return JsonDocument.Parse(json).RootElement is { ValueKind: JsonValueKind.Object } e
                ? Text(e, "text")
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Text(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var value) &&
        value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static long Long(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var value) &&
        value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var number)
            ? number
            : 0;

    private static decimal? Decimal(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var value) &&
        value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)
            ? number
            : null;
}
