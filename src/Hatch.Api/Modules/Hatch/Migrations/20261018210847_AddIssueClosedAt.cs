using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class AddIssueClosedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ClosedAt",
                schema: "hatch",
                table: "Issues",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Issues_StatusId_ClosedAt",
                schema: "hatch",
                table: "Issues",
                columns: new[] { "StatusId", "ClosedAt" });

            // Every issue already in a terminal column gets the instant it last
            // changed status, the way a read of its event trail would have found
            // it; one with no such event (imported straight into a terminal
            // column) falls back to its UpdatedAt rather than staying null, so
            // nothing standing in a terminal column is left without a ClosedAt.
            migrationBuilder.Sql("""
            UPDATE hatch."Issues" i
            SET "ClosedAt" = COALESCE(
                (SELECT MAX(e."At") FROM hatch."IssueEvents" e
                 WHERE e."IssueId" = i."Id" AND e."Kind" = 'status_changed'),
                i."UpdatedAt")
            FROM hatch."Statuses" s
            WHERE s."Id" = i."StatusId" AND s."IsTerminal" = true;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Issues_StatusId_ClosedAt",
                schema: "hatch",
                table: "Issues");

            migrationBuilder.DropColumn(
                name: "ClosedAt",
                schema: "hatch",
                table: "Issues");
        }
    }
}
