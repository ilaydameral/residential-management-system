using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOccupancyManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OccupancyTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OccupancyTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UnitOccupancies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    UnitId = table.Column<int>(type: "int", nullable: false),
                    OccupancyTypeId = table.Column<int>(type: "int", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitOccupancies", x => x.Id);
                    table.CheckConstraint("CK_UnitOccupancies_EndDate_After_StartDate", "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
                    table.ForeignKey(
                        name: "FK_UnitOccupancies_OccupancyTypes_OccupancyTypeId",
                        column: x => x.OccupancyTypeId,
                        principalTable: "OccupancyTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitOccupancies_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitOccupancies_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "OccupancyTypes",
                columns: new[] { "Id", "Code", "Description", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, "OWNER", "Property owner associated with the unit", true, "Owner" },
                    { 2, "TENANT", "Tenant currently or historically associated with the unit", true, "Tenant" },
                    { 3, "HOUSEHOLD_MEMBER", "Household member residing in the unit without ownership or tenancy responsibility", true, "Household Member" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_OccupancyTypes_Code",
                table: "OccupancyTypes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UnitOccupancies_OccupancyTypeId",
                table: "UnitOccupancies",
                column: "OccupancyTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitOccupancies_UnitId",
                table: "UnitOccupancies",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitOccupancies_UnitId_IsActive",
                table: "UnitOccupancies",
                columns: new[] { "UnitId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_UnitOccupancies_UserId",
                table: "UnitOccupancies",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitOccupancies_UserId_IsActive",
                table: "UnitOccupancies",
                columns: new[] { "UserId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UnitOccupancies");

            migrationBuilder.DropTable(
                name: "OccupancyTypes");
        }
    }
}
