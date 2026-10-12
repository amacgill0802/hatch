using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <remarks>
    /// Adds the one column and gates nothing - no seed, the same shape as
    /// <c>20261009225804_StallMark.cs</c>. A field nothing sets and nothing
    /// reads changes no board until HA-440, HA-437, HA-438 and HA-439 land.
    /// </remarks>
    public partial class PullRequestClosedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PullRequestClosedAt",
                schema: "hatch",
                table: "Issues",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PullRequestClosedAt",
                schema: "hatch",
                table: "Issues");
        }
    }
}
