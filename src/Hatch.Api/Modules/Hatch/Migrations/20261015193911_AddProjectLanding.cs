using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectLanding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ChecksRequired",
                schema: "hatch",
                table: "Projects",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Landing",
                schema: "hatch",
                table: "Projects",
                type: "text",
                nullable: false,
                defaultValue: "pull-request");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChecksRequired",
                schema: "hatch",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "Landing",
                schema: "hatch",
                table: "Projects");
        }
    }
}
