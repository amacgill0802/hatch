using Hatch.Api.Modules.Hatch;
using Hatch.Api.Modules.Hatch.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// The backfill statement <see cref="AddIssueClosedAt"/> runs, against real
/// rows. <see cref="HatchDatabase"/> builds its scratch schema from the model
/// and never runs a migration's <c>Up()</c>, so this lifts the one SQL
/// operation out of it and runs that exact text: an edit to the migration that
/// changes what the statement does breaks this test instead of drifting
/// beside a copy of it.
/// </summary>
[Collection(HatchDatabaseCollection.Name)]
public class IssueClosedAtBackfillTests
{
    private static readonly DateTimeOffset T0 = new(2026, 3, 1, 9, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// Runs under a plain <c>make test-api</c>, so the probe compiles and
    /// extracts on every run and not only in the database lane.
    /// </summary>
    [Fact]
    public void The_migration_carries_one_backfill_statement_over_the_issues_table()
    {
        Assert.Contains("hatch.\"Issues\"", BackfillSql);
    }

    [SkippableFact]
    public async Task On_a_real_database_the_backfill_stamps_each_terminal_issue_with_its_own_last_status_change()
    {
        Skip.IfNot(HatchDatabase.Available, "HATCH_TEST_DATABASE_URL is unset - run `make test-api-db`.");

        var connectionString = await HatchDatabase.PrepareAsync();
        await using var db = new HatchContext(new DbContextOptionsBuilder<HatchContext>().UseNpgsql(connectionString).Options);

        var project = new EfHatchProject { Key = "BF", Name = "Backfill", CreatedAt = T0 };
        var todo = new EfHatchStatus { Name = "todo", SortOrder = 10 };
        var done = new EfHatchStatus { Name = "done", SortOrder = 20, IsTerminal = true };
        db.AddRange(project, todo, done);
        await db.SaveChangesAsync();

        // UpdatedAt is distinct from every event instant, so the fallback and
        // the event path cannot be mistaken for each other.
        EfHatchIssue File(int number, EfHatchStatus status, DateTimeOffset updatedAt) => new()
        {
            ProjectId = project.Id,
            Number = number,
            Type = "task",
            Title = $"Issue {number}",
            StatusId = status.Id,
            Rank = number * 1024,
            CreatedBy = "operator",
            CreatedAt = T0,
            UpdatedAt = updatedAt,
        };

        var a = File(1, done, T0.AddDays(30));
        var b = File(2, done, T0.AddDays(31));
        var c = File(3, done, T0.AddDays(32));
        var d = File(4, todo, T0.AddDays(33));
        db.Issues.AddRange(a, b, c, d);
        await db.SaveChangesAsync();

        EfHatchIssueEvent Event(EfHatchIssue issue, string kind, DateTimeOffset at) => new()
        {
            IssueId = issue.Id,
            Actor = "operator",
            Kind = kind,
            Payload = "{}",
            At = at,
        };

        var aLater = T0.AddDays(5);
        var cOnly = T0.AddDays(9);
        db.IssueEvents.AddRange(
            // A: the later status change is written first, so insert order is not the answer.
            Event(a, EfHatchIssueEvent.StatusChanged, aLater),
            Event(a, EfHatchIssueEvent.StatusChanged, T0.AddDays(2)),
            // A retitle after both proves the Kind filter.
            Event(a, EfHatchIssueEvent.Retitled, T0.AddDays(20)),
            // B: events, but none of them a status change.
            Event(b, EfHatchIssueEvent.Created, T0.AddDays(1)),
            // C: later than A's, so a subquery not correlated on IssueId would give A this.
            Event(c, EfHatchIssueEvent.StatusChanged, cOnly),
            // D: sits in a non-terminal column and has status changes of its own.
            Event(d, EfHatchIssueEvent.StatusChanged, T0.AddDays(3)),
            Event(d, EfHatchIssueEvent.StatusChanged, T0.AddDays(4)));
        await db.SaveChangesAsync();

        // Otherwise a column that was already populated would pass vacuously.
        db.ChangeTracker.Clear();
        Assert.All(await db.Issues.AsNoTracking().ToListAsync(), i => Assert.Null(i.ClosedAt));

        await db.Database.ExecuteSqlRawAsync(BackfillSql);

        db.ChangeTracker.Clear();
        var byNumber = await db.Issues.AsNoTracking().ToDictionaryAsync(i => i.Number);

        Assert.Equal(aLater, byNumber[1].ClosedAt);
        Assert.Equal(b.UpdatedAt, byNumber[2].ClosedAt);
        Assert.Equal(cOnly, byNumber[3].ClosedAt);
        Assert.Null(byNumber[4].ClosedAt);
    }

    private static string BackfillSql => new AddIssueClosedAtProbe().Forward.OfType<SqlOperation>().Single().Sql;

    private sealed class AddIssueClosedAtProbe : AddIssueClosedAt
    {
        public IReadOnlyList<MigrationOperation> Forward
        {
            get
            {
                var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
                Up(builder);
                return builder.Operations;
            }
        }
    }
}
