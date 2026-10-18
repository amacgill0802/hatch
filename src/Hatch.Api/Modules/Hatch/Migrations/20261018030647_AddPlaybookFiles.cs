using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Hatch.Api.Modules.Hatch.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaybookFiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlaybookFiles",
                schema: "hatch",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Remote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Canonical = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Trunk = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Sha = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    State = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Rows = table.Column<string>(type: "jsonb", nullable: true),
                    Problem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    LastGoodSha = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    LastGoodHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Runner = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    CheckedBy = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaybookFiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlaybookFiles_Canonical_Trunk",
                schema: "hatch",
                table: "PlaybookFiles",
                columns: new[] { "Canonical", "Trunk" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlaybookFiles",
                schema: "hatch");
        }
    }
}
