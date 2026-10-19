using System.Text.Json;

namespace Hatch.Cli;

/// <summary>
/// Codex's own hook-answer shapes, for <c>hatch inbox</c> to print.
/// </summary>
/// <remarks>
/// These are the shapes the vendor's hooks page documents: a Stop hook that
/// prints <c>{"decision":"block","reason":"..."}</c> keeps Codex going with the
/// reason as a new continuation prompt, and a PostToolUse hook that prints
/// <c>hookSpecificOutput.additionalContext</c> adds it as developer context.
/// They happen to equal <see cref="ClaudeHookOutputWriter"/>'s byte for byte
/// today; that is a fact about two vendors' current docs, and either can
/// change, so this is its own class. PostToolUse deliberately never uses
/// <c>decision:"block"</c> (it replaces the tool result with the reason), and
/// neither hook emits <c>continue:false</c>, <c>suppressOutput</c> or
/// <c>updatedMCPToolOutput</c>.
/// </remarks>
internal sealed class CodexHookOutputWriter : IHookOutputWriter
{
    public string WriteStop(string text) =>
        JsonSerializer.Serialize(new StopBlock("block", text), HatchJson.Default.StopBlock);

    public string WritePostToolUse(string text) =>
        JsonSerializer.Serialize(
            new PostToolUseOutput(new PostToolUseContext("PostToolUse", text)), HatchJson.Default.PostToolUseOutput);
}
