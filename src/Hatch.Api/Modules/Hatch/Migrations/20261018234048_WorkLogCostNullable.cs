using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class WorkLogCostNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "CostUsd",
                schema: "hatch",
                table: "WorkLogEntries",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,8)",
                oldPrecision: 18,
                oldScale: 8);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Unpriced rows have no value to keep and the old column cannot hold
            // null, so a rollback would fail on the first one without this.
            migrationBuilder.Sql("UPDATE hatch.\"WorkLogEntries\" SET \"CostUsd\" = 0 WHERE \"CostUsd\" IS NULL;");

            migrationBuilder.AlterColumn<decimal>(
                name: "CostUsd",
                schema: "hatch",
                table: "WorkLogEntries",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,8)",
                oldPrecision: 18,
                oldScale: 8,
                oldNullable: true);
        }
    }
}
