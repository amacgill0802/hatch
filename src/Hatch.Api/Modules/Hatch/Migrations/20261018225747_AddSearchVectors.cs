using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class AddSearchVectors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                schema: "hatch",
                table: "WorkLogEntries",
                type: "tsvector",
                nullable: false,
                computedColumnSql: "setweight(to_tsvector('english', coalesce(\"Title\", '')), 'D') || setweight(to_tsvector('english', coalesce(\"Summary\", '')), 'D')",
                stored: true);

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                schema: "hatch",
                table: "Issues",
                type: "tsvector",
                nullable: false,
                computedColumnSql: "setweight(to_tsvector('english', \"Title\"), 'A') || setweight(to_tsvector('english', \"Description\"), 'B')",
                stored: true);

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                schema: "hatch",
                table: "Comments",
                type: "tsvector",
                nullable: false,
                computedColumnSql: "setweight(to_tsvector('english', \"Body\"), 'C')",
                stored: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkLogEntries_SearchVector",
                schema: "hatch",
                table: "WorkLogEntries",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_Issues_SearchVector",
                schema: "hatch",
                table: "Issues",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_SearchVector",
                schema: "hatch",
                table: "Comments",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkLogEntries_SearchVector",
                schema: "hatch",
                table: "WorkLogEntries");

            migrationBuilder.DropIndex(
                name: "IX_Issues_SearchVector",
                schema: "hatch",
                table: "Issues");

            migrationBuilder.DropIndex(
                name: "IX_Comments_SearchVector",
                schema: "hatch",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                schema: "hatch",
                table: "WorkLogEntries");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                schema: "hatch",
                table: "Issues");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                schema: "hatch",
                table: "Comments");
        }
    }
}
