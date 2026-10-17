using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class AddPullRequestState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PullRequestHeadSha",
                schema: "hatch",
                table: "Issues",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PullRequestMergeState",
                schema: "hatch",
                table: "Issues",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PullRequestReadAt",
                schema: "hatch",
                table: "Issues",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PullRequestReviewDecision",
                schema: "hatch",
                table: "Issues",
                type: "character varying(24)",
                maxLength: 24,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PullRequestHeadSha",
                schema: "hatch",
                table: "Issues");

            migrationBuilder.DropColumn(
                name: "PullRequestMergeState",
                schema: "hatch",
                table: "Issues");

            migrationBuilder.DropColumn(
                name: "PullRequestReadAt",
                schema: "hatch",
                table: "Issues");

            migrationBuilder.DropColumn(
                name: "PullRequestReviewDecision",
                schema: "hatch",
                table: "Issues");
        }
    }
}
