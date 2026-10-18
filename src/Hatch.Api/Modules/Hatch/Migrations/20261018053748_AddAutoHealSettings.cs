using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class AddAutoHealSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoHealBugEnabled",
                schema: "hatch",
                table: "Projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "AutoHealBugPreApproval",
                schema: "hatch",
                table: "Projects",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "AutoHealBugPriority",
                schema: "hatch",
                table: "Projects",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<int>(
                name: "AutoHealBugStatusId",
                schema: "hatch",
                table: "Projects",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Projects_AutoHealBugStatusId",
                schema: "hatch",
                table: "Projects",
                column: "AutoHealBugStatusId");

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Statuses_AutoHealBugStatusId",
                schema: "hatch",
                table: "Projects",
                column: "AutoHealBugStatusId",
                principalSchema: "hatch",
                principalTable: "Statuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Statuses_AutoHealBugStatusId",
                schema: "hatch",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Projects_AutoHealBugStatusId",
                schema: "hatch",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "AutoHealBugEnabled",
                schema: "hatch",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "AutoHealBugPreApproval",
                schema: "hatch",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "AutoHealBugPriority",
                schema: "hatch",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "AutoHealBugStatusId",
                schema: "hatch",
                table: "Projects");
        }
    }
}
