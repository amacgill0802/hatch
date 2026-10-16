using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class AddVerdicts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Verdicts",
                schema: "hatch",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IssueId = table.Column<long>(type: "bigint", nullable: false),
                    PlaybookId = table.Column<int>(type: "integer", nullable: false),
                    StatusId = table.Column<int>(type: "integer", nullable: false),
                    Verdict = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Findings = table.Column<string>(type: "character varying(100000)", maxLength: 100000, nullable: true),
                    Author = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    ClaimToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AppliedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Verdicts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Verdicts_Issues_IssueId",
                        column: x => x.IssueId,
                        principalSchema: "hatch",
                        principalTable: "Issues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Verdicts_Playbooks_PlaybookId",
                        column: x => x.PlaybookId,
                        principalSchema: "hatch",
                        principalTable: "Playbooks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Verdicts_Statuses_StatusId",
                        column: x => x.StatusId,
                        principalSchema: "hatch",
                        principalTable: "Statuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Verdicts_IssueId_ClaimToken",
                schema: "hatch",
                table: "Verdicts",
                columns: new[] { "IssueId", "ClaimToken" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Verdicts_PlaybookId",
                schema: "hatch",
                table: "Verdicts",
                column: "PlaybookId");

            migrationBuilder.CreateIndex(
                name: "IX_Verdicts_StatusId",
                schema: "hatch",
                table: "Verdicts",
                column: "StatusId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Verdicts",
                schema: "hatch");
        }
    }
}
