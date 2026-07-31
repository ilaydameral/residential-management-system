using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitTypesLookup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UnitTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitTypes", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "UnitTypes",
                columns: new[] { "Id", "Code", "CreatedAt", "Description", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, "APARTMENT", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Konut / Mesken birimi", true, "Daire" },
                    { 2, "SHOP", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Ticari dükkan veya mağaza", true, "Dükkan" },
                    { 3, "OFFICE", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Büro veya çalışma alanı", true, "Ofis" },
                    { 4, "STORAGE", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Bağımsız depo veya sığınak alanı", true, "Depo" },
                    { 5, "PARKING_SPACE", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Tahsisli araç park yeri", true, "Otopark Alanı" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_UnitTypes_Code",
                table: "UnitTypes",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UnitTypes");
        }
    }
}
