using System.Text.Json;

namespace Hatch.Cli.Tests;

/// <summary>
/// <see cref="CodexHookOutputWriter"/> prints the shapes Codex's hooks page
/// documents, exactly - a hook that prints anything else is ignored or marks
/// the hook run failed.
/// </summary>
public sealed class CodexHookOutputWriterTests
{
    private readonly CodexHookOutputWriter _writer = new();

    [Fact]
    public void WriteStop_is_a_block_decision_with_the_text_as_the_reason()
    {
        Assert.Equal("{\"decision\":\"block\",\"reason\":\"x\"}", _writer.WriteStop("x"));
    }

    [Fact]
    public void WritePostToolUse_is_additional_context_and_nothing_else()
    {
        var output = _writer.WritePostToolUse("x");

        Assert.Equal(
            "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"x\"}}", output);

        // A decision on PostToolUse would replace the tool result with the message.
        var root = JsonDocument.Parse(output).RootElement;
        Assert.Equal(["hookSpecificOutput"], root.EnumerateObject().Select(p => p.Name));
        Assert.DoesNotContain("decision", output, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("stop")]
    [InlineData("post-tool-use")]
    public void Text_with_a_quote_a_newline_and_non_ascii_round_trips_as_valid_json(string hook)
    {
        const string text = "say \"hi\"\nthen é中\U0001F600 and a \\ backslash";

        var root = JsonDocument.Parse(hook == "stop" ? _writer.WriteStop(text) : _writer.WritePostToolUse(text))
            .RootElement;

        var actual = hook == "stop"
            ? root.GetProperty("reason").GetString()
            : root.GetProperty("hookSpecificOutput").GetProperty("additionalContext").GetString();

        Assert.Equal(text, actual);
    }
}
