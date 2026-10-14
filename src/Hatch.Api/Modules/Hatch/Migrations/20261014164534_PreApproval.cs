using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <summary>
    /// Replaces the two-value <c>Express</c> flag with the three-value
    /// <c>PreApproval</c> - see <see cref="EfHatchIssue.PreApproval"/> and
    /// <see cref="Hatch.Contracts.PreApprovalLevels"/>.
    ///
    /// <c>Down</c> collapses express and pre-approved back into one flag and
    /// the distinction between them is lost - that is expected of a rollback
    /// of a migration that adds a level, not a bug in this one.
    /// </summary>
    /// <inheritdoc />
    public partial class PreApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PreApproval",
                schema: "hatch",
                table: "Issues",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""UPDATE hatch."Issues" SET "PreApproval" = 1 WHERE "Express" = true;""");

            migrationBuilder.DropColumn(
                name: "Express",
                schema: "hatch",
                table: "Issues");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Express",
                schema: "hatch",
                table: "Issues",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("""UPDATE hatch."Issues" SET "Express" = ("PreApproval" >= 1);""");

            migrationBuilder.DropColumn(
                name: "PreApproval",
                schema: "hatch",
                table: "Issues");
        }
    }
}
