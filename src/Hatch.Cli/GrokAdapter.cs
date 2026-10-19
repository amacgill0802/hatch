using System.Diagnostics;

namespace Hatch.Cli;

/// <summary>
/// The grok CLI, behind <see cref="IAgentAdapter"/>.
/// </summary>
/// <remarks>
/// <para><b>No hooks</b> (HA-711 decision 6). Grok's hooks load only from
/// <c>~/.grok/hooks/*.json</c>, <c>~/.grok/config.toml</c>,
/// <c>~/.claude/settings.json</c>, or the project itself - the last forbidden
/// by the tree check without <c>--trust</c>. <c>GROK_CONFIG</c>/
/// <c>GROK_CONFIG_PATH</c> overlays exclude hooks from their own allow-list,
/// and there is no <c>--settings</c>/<c>--hooks</c> flag to point elsewhere.
/// Writing the operator's real <c>~/.grok/hooks</c> would leak into every grok
/// session on the machine; relocating <c>GROK_HOME</c> would copy
/// <c>auth.json</c> (a <c>grok login</c> refresh rotates the token under the
/// real login) and move <c>sessions/</c> from under <c>grok -r</c> - both
/// worse than simply having none.</para>
/// </remarks>
public sealed class GrokAdapter : IAgentAdapter
{
    /// <summary>
    /// The playbook's tiers onto this vendor's own ids, dated 2026-10-19. All
    /// three shipped null (omit <c>-m</c>, taking the CLI's own default) - the
    /// vendor's documented default itself moves between doc pages
    /// (<c>grok-4.5</c> on one, <c>grok-4.6</c> on another), so a pinned id
    /// here would go stale faster than leaving it unset. HA-918 fills these in
    /// from a real <c>grok models</c> listing.
    /// </summary>
    internal static readonly IReadOnlyDictionary<string, string?> DefaultTiers = new Dictionary<string, string?>
    {
        ["sonnet"] = null,
        ["haiku"] = null,
        ["opus"] = null,
        ["fable"] = null,
    };

    private readonly string? _configured;
    private readonly Action<string>? _warn;
    private readonly IReadOnlyDictionary<string, string?> _tiers;

    /// <summary>The binary <see cref="CanSpawn"/> found, and null until it has.</summary>
    private string? _bin;

    private bool _warnedAddDirs;
    private bool _warnedHooks;

    /// <param name="tiers">
    /// Overrides onto <see cref="DefaultTiers"/>, so a test can pin a
    /// real-looking id without this adapter's shipped defaults going stale
    /// under it.
    /// </param>
    public GrokAdapter(string? configured = null, Action<string>? warn = null, IReadOnlyDictionary<string, string?>? tiers = null)
    {
        _configured = configured;
        _warn = warn;

        var merged = new Dictionary<string, string?>(DefaultTiers);
        if (tiers is not null)
            foreach (var (alias, id) in tiers)
                merged[alias] = id;
        _tiers = merged;

        // haiku, opus and fable are meant to be distinct tiers; shipped null
        // (above) they collapse onto the same CLI default sonnet already asks
        // for on purpose, which is worth saying once rather than leaving
        // silent until HA-918 pins real ids.
        if (new[] { "haiku", "opus", "fable" }.Count(alias => _tiers.TryGetValue(alias, out var id) && id is null) > 1)
            _warn?.Invoke("hatch: grok - haiku, opus and fable run on the CLI's default model here");
    }

    public string Id => "grok";

    public string DisplayName => "Grok";

    public IUsageProbe? Probe => null;

    public IHookOutputWriter HookOutput { get; } = new ClaudeHookOutputWriter();

    public bool PromptOnStdin => false;

    public bool CanHook => false;

    public bool CanDeny(IReadOnlyList<string> rules, out string refusal)
    {
        foreach (var rule in rules)
        {
            if (Classify(rule) == RuleKind.Refused)
            {
                refusal = Refusal(rule);
                return false;
            }
        }

        refusal = "";
        return true;
    }

    public bool CanSpawn(out string refusal)
    {
        if (_bin is not null)
        {
            refusal = "";
            return true;
        }

        if (!TryFind(_configured, out var found, out refusal)) return false;

        _bin = found;
        return true;
    }

    public ProcessStartInfo BuildHeadless(SessionRequest request)
    {
        var start = Base(request);

        if (request.SessionId is { Length: > 0 } sessionId)
        {
            start.ArgumentList.Add("-s");
            start.ArgumentList.Add(sessionId);
        }

        // Grok never reads stdin, and `-p <PROMPT>` would put the whole prompt
        // in argv - a limit Windows caps near 32,000 chars, and visible to
        // anything reading the process list besides. A file outside the tree
        // avoids both.
        File.WriteAllText(PromptFile(request), request.Prompt);
        start.ArgumentList.Add("--prompt-file");
        start.ArgumentList.Add(PromptFile(request));

        // Stops the CLI interpreting a machine-composed prompt as anything but
        // literal text.
        start.ArgumentList.Add("--verbatim");

        start.ArgumentList.Add("--output-format");
        start.ArgumentList.Add(request.Quiet ? "json" : "streaming-json");

        // bypassPermissions's own justification applies here too - see
        // ClaudeAdapter.BuildHeadless. Deny rules still apply under it, below.
        start.ArgumentList.Add("--always-approve");

        // The vendor gates AGENTS.md, project skills and hooks behind folder
        // trust; a runner cloning its own workspaces has no prior grant, and
        // without this AGENTS.md is silently never read.
        start.ArgumentList.Add("--trust");

        // A background update mid-night would change the binary mid-loop.
        start.ArgumentList.Add("--no-auto-update");

        start.RedirectStandardInput = true;
        start.RedirectStandardOutput = true;

        return start;
    }

    public ProcessStartInfo BuildAttached(SessionRequest request)
    {
        // No --always-approve, --trust, --prompt-file, --output-format or -s -
        // a person answers prompts here. And the prompt is a positional
        // argument rather than stdin, because stdin is the terminal: it is
        // what the operator is about to type into.
        var start = Base(request);
        start.ArgumentList.Add(request.Prompt);
        return start;
    }

    public void Release(SessionRequest request)
    {
        try { File.Delete(PromptFile(request)); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            // Nothing left to clean up, or nothing this process may touch -
            // either way, not a reason to fail an increment that already ran.
        }
    }

    public IAgentStreamReader CreateReader(string root, RunFacts facts, string model) =>
        new GrokStreamReader(root, facts, ResumeCommand);

    public string? ReadClosing(string json) => GrokStreamReader.Closing(json);

    public string ResumeCommand(string sessionId) => $"grok -r {sessionId}";

    public IAgentHooks? WriteHooks(string temp, string key, string hatch, string? rtk)
    {
        if (!_warnedHooks)
        {
            _warnedHooks = true;
            _warn?.Invoke(
                "hatch: grok has no hooks Hatch can lend a single session - a message sent while it works waits for the next session; only the hard token limit holds");
        }

        return null;
    }

    public UsageLimit.Recognised? RecogniseLimit(string? said, DateTimeOffset endedAt, TimeZoneInfo? runnerZone = null) =>
        UsageLimit.RecogniseGrok(said, endedAt);

    /// <summary>
    /// The binary to spawn, which is only known once <see cref="CanSpawn"/> has
    /// said there is one. A caller that skipped the question is a bug, and
    /// spawning whatever <c>PATH</c> happens to offer would hide it.
    /// </summary>
    private string Bin => _bin
        ?? throw new InvalidOperationException("CanSpawn was never asked, so there is no grok CLI to spawn");

    internal ProcessStartInfo Base(SessionRequest request)
    {
        var start = new ProcessStartInfo
        {
            FileName = Bin,
            WorkingDirectory = request.Root,
            UseShellExecute = false,
        };

        // The prompt this session is about to be handed names `hatch` commands,
        // so the word has to resolve inside it. See Reach. Its calls name the
        // runner that dispatched it, not the person the checkout belongs to.
        Reach.OnPath(start.Environment, Reach.OwnDirectory(Environment.ProcessPath));
        Reach.AsRunner(start.Environment, request.RunnerName);

        if (MapModel(request.Model) is { } mapped)
        {
            start.ArgumentList.Add("-m");
            start.ArgumentList.Add(mapped);
        }

        start.ArgumentList.Add("--effort");
        start.ArgumentList.Add(request.Effort);
        start.ArgumentList.Add("--cwd");
        start.ArgumentList.Add(request.Root);

        var disallowedAgent = false;
        var deny = new List<string>();
        foreach (var rule in request.DeniedTools)
        {
            switch (Classify(rule))
            {
                case RuleKind.Agent: disallowedAgent = true; break;
                case RuleKind.Deny: deny.Add(rule); break;
                default: throw new InvalidOperationException(Refusal(rule));
            }
        }

        if (disallowedAgent)
        {
            start.ArgumentList.Add("--disallowed-tools");
            start.ArgumentList.Add("Agent");
        }

        foreach (var rule in deny)
        {
            start.ArgumentList.Add("--deny");
            start.ArgumentList.Add(rule);
        }

        // Grok documents no --add-dir (`additionalDirectories` "parsed but not
        // supported"). Still reachable by their absolute paths - --always-approve
        // with no --sandbox restricts no path.
        if (request.AddDirs.Count > 0 && !_warnedAddDirs)
        {
            _warnedAddDirs = true;
            _warn?.Invoke(
                "hatch: grok has no add-dir flag - other checkouts of this project are reachable by their absolute paths only");
        }

        return start;
    }

    /// <summary>The playbook's tier aliases onto this vendor's own ids; anything else, including a pinned id, passes through.</summary>
    private string? MapModel(string model) => _tiers.TryGetValue(model, out var mapped) ? mapped : model;

    private enum RuleKind { Deny, Agent, Refused }

    /// <summary>
    /// A denied-tools rule onto what grok can do with it (HA-711 decision 5):
    /// the bare literal <c>Agent</c> is grok's own <c>--disallowed-tools</c>
    /// entry; a rule naming one of grok's <c>--deny</c> tools, with or without
    /// a parenthesised pattern, passes straight through; everything else -
    /// including <c>Agent(...)</c>, since the parenthesis takes it out of the
    /// bare-literal case - has no equivalent and is refused.
    /// </summary>
    private static RuleKind Classify(string rule)
    {
        if (rule == "Agent") return RuleKind.Agent;

        var paren = rule.IndexOf('(');
        var name = paren < 0 ? rule : rule[..paren];

        return name is "Bash" or "Read" or "Edit" or "Write" or "Grep" or "Glob" or "WebFetch" or "WebSearch"
            ? RuleKind.Deny
            : RuleKind.Refused;
    }

    private static string Refusal(string rule) =>
        $"hatch: grok cannot honour the playbook's denied-tools rule \"{rule}\" - it has no equivalent, so this increment is not spawned under grok";

    /// <summary>
    /// Where <see cref="BuildHeadless"/> writes <see cref="SessionRequest.Prompt"/>
    /// and <see cref="Release"/> deletes it from - recomputed from
    /// <paramref name="request"/> alone rather than stored, the way
    /// <see cref="CodexAdapter.OutputLastMessagePath"/> is. <see
    /// cref="SessionRequest.SessionId"/> is always set by the time a real spawn
    /// reaches here (<see cref="CreateReader"/> mints one before <see
    /// cref="SessionRequest"/> is built); <see cref="Guid.Empty"/> stands in
    /// for the fallback so the path a direct caller computed to write is the
    /// same one it computes to delete.
    /// </summary>
    private static string PromptFile(SessionRequest request) =>
        Path.Combine(Path.GetTempPath(), $"hatch-grok-{request.SessionId ?? Guid.Empty.ToString()}.md");

    /// <summary>
    /// The CLI that runs the increment.
    /// </summary>
    /// <remarks>
    /// Headless auth is <c>XAI_API_KEY</c> or a cached <c>grok login</c> token -
    /// neither this adapter's concern, since a CLI that refuses to run without
    /// one says so on its own stderr.
    /// </remarks>
    private static bool TryFind(string? configured, out string bin, out string refusal)
    {
        refusal = "";

        if (!string.IsNullOrWhiteSpace(configured))
        {
            bin = configured;
            if (File.Exists(bin)) return true;

            refusal = $"hatch: HATCH_GROK_BIN is not there: {bin}";
            return false;
        }

        bin = "grok";
        if (Reach.Find("grok", Environment.GetEnvironmentVariable("PATH")) is { } found)
        {
            bin = found;
            return true;
        }

        refusal = string.Join('\n',
            "hatch: no grok CLI on PATH.",
            "",
            "  Install it (https://docs.x.ai/build/overview), or point at one you have:",
            "      export HATCH_GROK_BIN=/path/to/grok",
            "",
            "  Headless auth is XAI_API_KEY or a cached `grok login` token.");
        return false;
    }
}
