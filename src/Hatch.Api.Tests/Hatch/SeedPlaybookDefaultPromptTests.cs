using System.Text.RegularExpressions;
using Hatch.Api.Modules.Hatch;
using Hatch.Api.Modules.Hatch.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// Every stock playbook row learns the text it was prescribed, and a row nobody
/// has edited hands its wording back. These facts need no database: each text is
/// proved equal to the constant it was copied from, and the SQL is read for its
/// shape. Running it against a real database is a sibling's work.
/// </summary>
[Collection(HatchDatabaseCollection.Name)]
public class SeedPlaybookDefaultPromptTests
{
    [Fact]
    public void Each_frozen_text_equals_the_constant_it_was_copied_from()
    {
        Assert.Equal(RewordDiscreteTaskPlaybooks.EpicReplaced, SeedPlaybookDefaultPrompt.EpicBreakdown);
        Assert.Equal(ShrinkStockPlaybooks.StoryReplaced, SeedPlaybookDefaultPrompt.StoryBreakdown);
        Assert.Equal(SeededTaskBreakdown(), SeedPlaybookDefaultPrompt.TaskBreakdown);
        Assert.Equal(RetireEpicStartPlaybook.Stock, SeedPlaybookDefaultPrompt.EpicStart);
        Assert.Equal(ShrinkStockPlaybooks.AnalysisReplaced, SeedPlaybookDefaultPrompt.Analysis);
        Assert.Equal(ShrinkStockPlaybooks.ImplementationReplaced, SeedPlaybookDefaultPrompt.Implementation);
        Assert.Equal(SeedCloseoutPlaybook.Closeout, SeedPlaybookDefaultPrompt.Closeout);
        Assert.Equal(VerifyEpicPlaybook.Stock, SeedPlaybookDefaultPrompt.EpicVerification);
        Assert.Equal(RewordReviewPlaybook.Stock, SeedPlaybookDefaultPrompt.Review);
    }

    [Fact]
    public void Every_text_fits_the_column_and_the_first_seed_is_the_same_prompt_before_its_edit()
    {
        foreach (var text in SeedPlaybookDefaultPrompt.Current.Append(SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed))
            Assert.True(text.Length <= EfHatchPlaybook.MaxPromptLength);

        Assert.NotEqual(SeedPlaybookDefaultPrompt.TaskBreakdown, SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed);
        Assert.Equal(
            SeedPlaybookDefaultPrompt.OpeningLine(SeedPlaybookDefaultPrompt.TaskBreakdown),
            SeedPlaybookDefaultPrompt.OpeningLine(SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed));
    }

    [Fact]
    public void The_nine_opening_lines_are_distinct_and_none_is_a_prefix_of_another()
    {
        var lines = SeedPlaybookDefaultPrompt.Current.Select(SeedPlaybookDefaultPrompt.OpeningLine).ToList();

        Assert.Equal(9, lines.Count);
        foreach (var line in lines)
            Assert.Single(lines, other => other.StartsWith(line, StringComparison.Ordinal));
    }

    [Fact]
    public void No_opening_line_is_a_like_wildcard_or_escape_or_a_dollar_quote()
    {
        foreach (var text in SeedPlaybookDefaultPrompt.Current.Append(SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed))
        {
            Assert.DoesNotContain('$', text);
            Assert.DoesNotContain('\r', text);
            var line = SeedPlaybookDefaultPrompt.OpeningLine(text);
            Assert.NotEmpty(line);
            Assert.DoesNotContain('%', line);
            Assert.DoesNotContain('_', line);
            Assert.DoesNotContain('\\', line);
        }
    }

    [Fact]
    public void Up_matches_each_text_whole_on_Prompt_alone_then_by_opening_line_and_touches_nothing_else()
    {
        var sql = Sql(new Probe().Forward);

        foreach (var text in SeedPlaybookDefaultPrompt.Current)
        {
            var pass1 = sql.IndexOf($"WHERE \"Prompt\" = $prompt${text}$prompt$", StringComparison.Ordinal);
            var pass2 = sql.IndexOf(
                $"AND \"Prompt\" LIKE $prompt${SeedPlaybookDefaultPrompt.OpeningLine(text)}$prompt$ || '%'",
                StringComparison.Ordinal);

            Assert.True(pass1 >= 0, "no exact-text pass for " + SeedPlaybookDefaultPrompt.OpeningLine(text));
            Assert.True(pass2 > pass1, "the opening-line pass does not follow the exact-text pass for " + SeedPlaybookDefaultPrompt.OpeningLine(text));
        }

        Assert.Contains($"WHERE \"Prompt\" = $prompt${SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed}$prompt$", sql);
        Assert.Contains("SET \"DefaultPrompt\" = $prompt$", sql);
        Assert.Contains("\"Prompt\" = NULL", sql);
        Assert.Contains("\"DefaultPrompt\" IS NULL", sql);
        Assert.Contains("|| '%'", sql);

        // Neither the slot nor the scope: the wording alone decides, and learning a default is not an edit.
        Assert.DoesNotContain("FromStatusId", sql);
        Assert.DoesNotContain("ToStatusId", sql);
        Assert.DoesNotContain("\"Types\"", sql);
        Assert.DoesNotContain("\"Shape\"", sql);
        Assert.DoesNotContain("UpdatedAt", sql);
    }

    [Fact]
    public void Down_writes_the_defaults_back_into_Prompt_before_clearing_them_and_carries_no_text()
    {
        var operations = new Probe().Backward.OfType<SqlOperation>().Select(o => o.Sql).ToList();

        Assert.Equal(2, operations.Count);
        Assert.Contains("SET \"Prompt\" = \"DefaultPrompt\"", operations[0]);
        Assert.Contains("\"Prompt\" IS NULL", operations[0]);
        Assert.Contains("\"DefaultPrompt\" IS NOT NULL", operations[0]);
        Assert.Contains("SET \"DefaultPrompt\" = NULL", operations[1]);

        var sql = string.Join("\0", operations);
        foreach (var text in SeedPlaybookDefaultPrompt.Current.Append(SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed))
            Assert.DoesNotContain(SeedPlaybookDefaultPrompt.OpeningLine(text), sql);
        Assert.DoesNotContain("UpdatedAt", sql);
    }

    /// <summary>The task,bug prompt as the seed migration says it today: it is a literal inside SQL, with no constant.</summary>
    private static string SeededTaskBreakdown()
    {
        var sql = Sql(new SeedProbe().Forward);
        var holder = sql.Split('\0').Single(s => s.Contains("'task,bug', $prompt$", StringComparison.Ordinal));
        var match = Regex.Match(holder, @"'task,bug', \$prompt\$(.*?)\$prompt\$", RegexOptions.Singleline);
        Assert.True(match.Success);
        return match.Groups[1].Value;
    }

    private static string Sql(IReadOnlyList<MigrationOperation> operations) =>
        string.Join("\0", operations.OfType<SqlOperation>().Select(o => o.Sql));

    /// <summary>The seed's operations, without a database to run them against.</summary>
    private sealed class SeedProbe : Playbooks
    {
        public IReadOnlyList<MigrationOperation> Forward => Operations(Up);

        private static IReadOnlyList<MigrationOperation> Operations(Action<MigrationBuilder> step)
        {
            var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
            step(builder);
            return builder.Operations;
        }
    }

    /// <summary>The migration's operations, without a database to run them against.</summary>
    private sealed class Probe : SeedPlaybookDefaultPrompt
    {
        public IReadOnlyList<MigrationOperation> Forward => Operations(Up);

        public IReadOnlyList<MigrationOperation> Backward => Operations(Down);

        private static IReadOnlyList<MigrationOperation> Operations(Action<MigrationBuilder> step)
        {
            var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
            step(builder);
            return builder.Operations;
        }
    }
}
