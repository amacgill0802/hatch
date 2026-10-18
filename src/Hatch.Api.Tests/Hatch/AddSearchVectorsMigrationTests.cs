using Hatch.Api.Modules.Hatch.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// <see cref="AddSearchVectors"/>'s <c>Up()</c>/<c>Down()</c>, lifted out and run
/// against a bare <see cref="MigrationBuilder"/> rather than a database - the
/// same probe shape <c>IssueClosedAtBackfillTests</c> uses for
/// <c>AddIssueClosedAt</c>. An edit to the migration that changes what it does
/// breaks this test instead of drifting beside a copy of it.
/// </summary>
public class AddSearchVectorsMigrationTests
{
    [Fact]
    public void Up_AddsThreeWeightedStoredColumns()
    {
        var columns = Up.OfType<AddColumnOperation>().ToList();
        Assert.Equal(3, columns.Count);
        Assert.All(columns, c => Assert.Equal("hatch", c.Schema));
        Assert.All(columns, c => Assert.True(c.IsStored));

        var issues = columns.Single(c => c.Table == "Issues");
        Assert.Contains("""setweight(to_tsvector('english', "Title"), 'A')""", issues.ComputedColumnSql);
        Assert.Contains("""setweight(to_tsvector('english', "Description"), 'B')""", issues.ComputedColumnSql);

        var comments = columns.Single(c => c.Table == "Comments");
        Assert.Contains("""setweight(to_tsvector('english', "Body"), 'C')""", comments.ComputedColumnSql);

        var workLog = columns.Single(c => c.Table == "WorkLogEntries");
        Assert.Contains("""setweight(to_tsvector('english', coalesce("Title", '')), 'D')""", workLog.ComputedColumnSql);
        Assert.Contains("""setweight(to_tsvector('english', coalesce("Summary", '')), 'D')""", workLog.ComputedColumnSql);
    }

    [Fact]
    public void Up_IndexesEachColumnWithGin()
    {
        var indexes = Up.OfType<CreateIndexOperation>().ToList();
        Assert.Equal(3, indexes.Count);
        Assert.All(indexes, i => Assert.Equal("GIN", i.FindAnnotation("Npgsql:IndexMethod")?.Value));
        Assert.Equal(
            ["Comments", "Issues", "WorkLogEntries"],
            indexes.Select(i => i.Table).OrderBy(t => t, StringComparer.Ordinal));
    }

    [Fact]
    public void Down_DropsAllThreeIndexesBeforeAllThreeColumns()
    {
        var lastIndexDrop = Down.ToList().FindLastIndex(o => o is DropIndexOperation);
        var firstColumnDrop = Down.ToList().FindIndex(o => o is DropColumnOperation);

        Assert.Equal(3, Down.OfType<DropIndexOperation>().Count());
        Assert.Equal(3, Down.OfType<DropColumnOperation>().Count());
        Assert.True(lastIndexDrop < firstColumnDrop);
    }

    private static IReadOnlyList<MigrationOperation> Up => new AddSearchVectorsProbe().Forward;
    private static IReadOnlyList<MigrationOperation> Down => new AddSearchVectorsProbe().Backward;

    private sealed class AddSearchVectorsProbe : AddSearchVectors
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

        public IReadOnlyList<MigrationOperation> Backward
        {
            get
            {
                var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
                Down(builder);
                return builder.Operations;
            }
        }
    }
}
