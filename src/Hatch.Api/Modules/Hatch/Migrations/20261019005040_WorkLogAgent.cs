using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class WorkLogAgent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Agent",
                schema: "hatch",
                table: "WorkLogEntries",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE hatch."WorkLogEntries" SET "Agent" = 'claude' WHERE "Agent" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Agent",
                schema: "hatch",
                table: "WorkLogEntries");
        }
    }
}
