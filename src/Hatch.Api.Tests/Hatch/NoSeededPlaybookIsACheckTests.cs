using Hatch.Api.Modules.Hatch;
using Hatch.Api.Modules.Hatch.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// No seeding migration turns a playbook into a check or denies it a tool, and
/// the review row still says what <see cref="RewordReviewPlaybook"/> left it.
/// <c>IsCheck</c> and <c>DeniedTools</c> are columns whose defaults are the
/// stock behaviour; a seed that named either would make a fresh install differ
/// from one that was never seeded.
/// </summary>
[Collection(HatchDatabaseCollection.Name)]
public class NoSeededPlaybookIsACheckTests
{
    /// <summary>
    /// Runs under a plain <c>make test-api</c>: it reads the SQL each seeding
    /// migration emits and needs no database.
    /// </summary>
    [Fact]
    public void No_seeding_migration_names_IsCheck_or_DeniedTools()
    {
        var sql = string.Join("\n", Migrations.SelectMany(m => m.Forward));

        Assert.NotEmpty(sql);
        Assert.DoesNotContain("IsCheck", sql);
        Assert.DoesNotContain("DeniedTools", sql);
    }

    [SkippableFact]
    public async Task On_a_real_database_every_seeded_row_keeps_the_column_defaults_and_the_review_row_is_the_reworded_one()
    {
        Skip.IfNot(HatchDatabase.Available, "HATCH_TEST_DATABASE_URL is unset - run `make test-api-db`.");

        var connectionString = await HatchDatabase.PrepareAsync();
        await using var db = new HatchContext(new DbContextOptionsBuilder<HatchContext>().UseNpgsql(connectionString).Options);

        // Stock names, which Playbooks joins on. The review status is added
        // here because the migration's own insert of it would trip the NOT NULL
        // bools EnsureCreated builds without defaults; with the row present its
        // guard skips it.
        db.AddRange(
            new EfHatchStatus { Name = "inbox", SortOrder = 10 },
            new EfHatchStatus { Name = "todo", SortOrder = 20 },
            new EfHatchStatus { Name = "in progress", SortOrder = 30 },
            new EfHatchStatus { Name = "review", SortOrder = 40 },
            new EfHatchStatus { Name = "done", SortOrder = 50, IsTerminal = true });
        await db.SaveChangesAsync();

        // RetireEpicStartPlaybook is left out on purpose: whether the epic-start
        // row goes depends on IsWip, which is that migration's own concern.
        foreach (var migration in Migrations)
            foreach (var sql in migration.Forward)
                await db.Database.ExecuteSqlRawAsync(sql);

        db.ChangeTracker.Clear();
        var rows = await db.Set<EfHatchPlaybook>().ToListAsync();

        // All over an empty list passes without checking anything.
        Assert.NotEmpty(rows);
        Assert.All(rows, p =>
        {
            Assert.False(p.IsCheck);
            Assert.Null(p.DeniedTools);
        });

        var review = rows.Single(p => p.FromStatusId == p.ToStatusId);
        Assert.Equal(RewordReviewPlaybook.Stock, review.Prompt);
    }

    /// <summary>
    /// Every migration that writes a playbook row, in migration order. Only the
    /// <see cref="SqlOperation"/>s: the table itself already exists by the time
    /// they run.
    /// </summary>
    private static IEnumerable<(string Name, IReadOnlyList<string> Forward)> Migrations =>
    [
        (nameof(Playbooks), Sql(new PlaybooksProbe().Forward)),
        (nameof(SeedConflictPlaybook), Sql(new SeedConflictPlaybookProbe().Forward)),
        (nameof(RewordReviewPlaybook), Sql(new RewordReviewPlaybookProbe().Forward)),
        (nameof(SeedCloseoutPlaybook), Sql(new SeedCloseoutPlaybookProbe().Forward)),
        (nameof(VerifyEpicPlaybook), Sql(new VerifyEpicPlaybookProbe().Forward)),
    ];

    private static IReadOnlyList<string> Sql(IReadOnlyList<MigrationOperation> operations) =>
        operations.OfType<SqlOperation>().Select(o => o.Sql).ToList();

    private static IReadOnlyList<MigrationOperation> Operations(Action<MigrationBuilder> step)
    {
        var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
        step(builder);
        return builder.Operations;
    }

    private sealed class PlaybooksProbe : Playbooks
    {
        public IReadOnlyList<MigrationOperation> Forward => Operations(Up);
    }

    private sealed class SeedConflictPlaybookProbe : SeedConflictPlaybook
    {
        public IReadOnlyList<MigrationOperation> Forward => Operations(Up);
    }

    private sealed class RewordReviewPlaybookProbe : RewordReviewPlaybook
    {
        public IReadOnlyList<MigrationOperation> Forward => Operations(Up);
    }

    private sealed class SeedCloseoutPlaybookProbe : SeedCloseoutPlaybook
    {
        public IReadOnlyList<MigrationOperation> Forward => Operations(Up);
    }

    private sealed class VerifyEpicPlaybookProbe : VerifyEpicPlaybook
    {
        public IReadOnlyList<MigrationOperation> Forward => Operations(Up);
    }
}
