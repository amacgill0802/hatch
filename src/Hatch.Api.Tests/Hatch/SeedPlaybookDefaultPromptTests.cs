using System.Text.RegularExpressions;
using Hatch.Api.Modules.Hatch;
using Hatch.Api.Modules.Hatch.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// Every stock playbook row learns the text it was prescribed, and a row nobody
/// has edited hands its wording back. These facts need no database: each text is
/// proved equal to the constant it was copied from, and the SQL is read for its
/// shape. The database facts at the end run that SQL against a real Postgres.
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

    private static readonly DateTimeOffset Seeded = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static readonly string EditedText = SeedPlaybookDefaultPrompt.Analysis + "\n- Also do this.";

    private static readonly string Rewritten =
        "Do something else entirely." + SeedPlaybookDefaultPrompt.Implementation[SeedPlaybookDefaultPrompt.Implementation.IndexOf('\n')..];

    private const string Unrelated = "Do whatever you like.";

    private static int _slot;

    [SkippableFact]
    public async Task An_unedited_row_hands_its_wording_back_whatever_its_types_and_keeps_its_UpdatedAt()
    {
        await using var db = await OpenAsync();
        var id = await AddRowAsync(db, SeedPlaybookDefaultPrompt.StoryBreakdown, types: "story,bug");

        await RunAsync(db, new Probe().Forward);

        var row = await ReadAsync(db, id);
        Assert.Null(row.Prompt);
        Assert.Equal(SeedPlaybookDefaultPrompt.StoryBreakdown, row.DefaultPrompt);
        Assert.Equal(Seeded, row.UpdatedAt);
    }

    [SkippableFact]
    public async Task An_edited_row_keeps_its_text_byte_for_byte_and_still_learns_the_default()
    {
        await using var db = await OpenAsync();
        var id = await AddRowAsync(db, EditedText, types: "", shape: "leaf");

        await RunAsync(db, new Probe().Forward);

        var row = await ReadAsync(db, id);
        Assert.Equal(EditedText, row.Prompt);
        Assert.Equal(SeedPlaybookDefaultPrompt.Analysis, row.DefaultPrompt);
    }

    [SkippableFact]
    public async Task A_row_whose_opening_line_was_rewritten_is_left_alone_with_no_default()
    {
        await using var db = await OpenAsync();
        var id = await AddRowAsync(db, Rewritten);

        await RunAsync(db, new Probe().Forward);

        var row = await ReadAsync(db, id);
        Assert.Equal(Rewritten, row.Prompt);
        Assert.Null(row.DefaultPrompt);
    }

    [SkippableFact]
    public async Task The_first_seed_of_the_task_bug_row_is_unedited_and_its_default_is_the_current_text()
    {
        await using var db = await OpenAsync();
        var id = await AddRowAsync(db, SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed, types: "task,bug");

        await RunAsync(db, new Probe().Forward);

        var row = await ReadAsync(db, id);
        Assert.Null(row.Prompt);
        Assert.Equal(SeedPlaybookDefaultPrompt.TaskBreakdown, row.DefaultPrompt);
    }

    [SkippableFact]
    public async Task A_row_with_unrelated_wording_is_untouched_and_has_no_default()
    {
        await using var db = await OpenAsync();
        var id = await AddRowAsync(db, Unrelated);

        await RunAsync(db, new Probe().Forward);

        var row = await ReadAsync(db, id);
        Assert.Equal(Unrelated, row.Prompt);
        Assert.Null(row.DefaultPrompt);
    }

    [SkippableFact]
    public async Task Running_Up_twice_leaves_the_state_running_it_once_did()
    {
        await using var db = await OpenAsync();
        var ids = await SeedAllAsync(db);

        await RunAsync(db, new Probe().Forward);
        var once = await SnapshotAsync(db, ids);
        await RunAsync(db, new Probe().Forward);
        var twice = await SnapshotAsync(db, ids);

        Assert.Equal(once, twice);
        Assert.Equal(
            new (string?, string?)[]
            {
                (null, SeedPlaybookDefaultPrompt.StoryBreakdown),
                (EditedText, SeedPlaybookDefaultPrompt.Analysis),
                (Rewritten, null),
                (null, SeedPlaybookDefaultPrompt.TaskBreakdown),
                (Unrelated, null),
            },
            once);
    }

    [SkippableFact]
    public async Task Down_after_Up_returns_each_prompt_and_clears_every_default_without_touching_UpdatedAt()
    {
        await using var db = await OpenAsync();
        var ids = await SeedAllAsync(db);

        await RunAsync(db, new Probe().Forward);
        await RunAsync(db, new Probe().Backward);

        var unedited = await ReadAsync(db, ids.Unedited);
        Assert.Equal(SeedPlaybookDefaultPrompt.StoryBreakdown, unedited.Prompt);
        Assert.Null(unedited.DefaultPrompt);
        Assert.Equal(Seeded, unedited.UpdatedAt);

        Assert.Equal(
            new (string?, string?)[]
            {
                (SeedPlaybookDefaultPrompt.StoryBreakdown, null),
                (EditedText, null),
                (Rewritten, null),
                // The one lossy case: the first seed comes back as the text it was edited to.
                (SeedPlaybookDefaultPrompt.TaskBreakdown, null),
                (Unrelated, null),
            },
            await SnapshotAsync(db, ids));
    }

    private sealed record Rows(int Unedited, int Edited, int Reopened, int FirstSeed, int Other);

    /// <summary>One row for each way a prompt can stand, each in a slot of its own.</summary>
    private static async Task<Rows> SeedAllAsync(HatchContext db) => new(
        await AddRowAsync(db, SeedPlaybookDefaultPrompt.StoryBreakdown, types: "story,bug"),
        await AddRowAsync(db, EditedText, types: "", shape: "leaf"),
        await AddRowAsync(db, Rewritten),
        await AddRowAsync(db, SeedPlaybookDefaultPrompt.TaskBreakdownFirstSeed, types: "task,bug"),
        await AddRowAsync(db, Unrelated));

    private static async Task<List<(string? Prompt, string? DefaultPrompt)>> SnapshotAsync(HatchContext db, Rows ids)
    {
        var rows = new List<(string?, string?)>();
        foreach (var id in new[] { ids.Unedited, ids.Edited, ids.Reopened, ids.FirstSeed, ids.Other })
        {
            var row = await ReadAsync(db, id);
            rows.Add((row.Prompt, row.DefaultPrompt));
        }

        return rows;
    }

    private static async Task<HatchContext> OpenAsync()
    {
        Skip.IfNot(HatchDatabase.Available, "HATCH_TEST_DATABASE_URL is unset - run `make test-api-db`.");

        var connectionString = await HatchDatabase.PrepareAsync();
        return new HatchContext(new DbContextOptionsBuilder<HatchContext>().UseNpgsql(connectionString).Options);
    }

    /// <summary>
    /// A playbook in a slot of its own. The unique index is on the from, to, types and
    /// shape, so each row gets a status of its own to move to, and a fact can set Types
    /// and Shape to what it is about.
    /// </summary>
    private static async Task<int> AddRowAsync(HatchContext db, string prompt, string types = "", string shape = "any")
    {
        var slot = Interlocked.Increment(ref _slot);
        var from = await db.Set<EfHatchStatus>().FirstOrDefaultAsync(s => s.Name == "From");
        if (from is null)
        {
            from = new EfHatchStatus { Name = "From", SortOrder = 1 };
            db.Add(from);
        }

        var to = new EfHatchStatus { Name = $"Slot {slot}", SortOrder = 100 + slot };
        db.Add(to);
        await db.SaveChangesAsync();

        var row = new EfHatchPlaybook
        {
            FromStatusId = from.Id, ToStatusId = to.Id,
            Types = types, Shape = shape, Prompt = prompt,
            Model = "sonnet", Effort = "high", CreatedAt = Seeded, UpdatedAt = Seeded,
        };
        db.Add(row);
        await db.SaveChangesAsync();
        return row.Id;
    }

    private static async Task RunAsync(HatchContext db, IReadOnlyList<MigrationOperation> operations)
    {
        foreach (var operation in operations.OfType<SqlOperation>())
            await db.Database.ExecuteSqlRawAsync(operation.Sql);
    }

    private static async Task<EfHatchPlaybook> ReadAsync(HatchContext db, int id)
    {
        db.ChangeTracker.Clear();
        return (await db.Set<EfHatchPlaybook>().FindAsync(id))!;
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
