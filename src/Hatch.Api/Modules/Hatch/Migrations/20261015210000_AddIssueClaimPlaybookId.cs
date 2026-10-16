using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <summary>
    /// Which playbook a claim was taken under, or null where none was named -
    /// see <see cref="EfHatchIssue.ClaimPlaybookId"/>. Nullable and
    /// defaultless: every existing row reads blank until a take names one.
    /// </summary>
    public partial class AddIssueClaimPlaybookId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ClaimPlaybookId",
                schema: "hatch",
                table: "Issues",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClaimPlaybookId",
                schema: "hatch",
                table: "Issues");
        }
    }
}
