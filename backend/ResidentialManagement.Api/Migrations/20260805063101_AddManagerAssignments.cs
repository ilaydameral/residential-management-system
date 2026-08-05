using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddManagerAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ManagerAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ManagerUserId = table.Column<int>(type: "int", nullable: false),
                    PropertyId = table.Column<int>(type: "int", nullable: false),
                    BuildingId = table.Column<int>(type: "int", nullable: true),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedByUserId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndedByUserId = table.Column<int>(type: "int", nullable: true),
                    EndReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ManagerAssignments", x => x.Id);
                    table.CheckConstraint("CK_ManagerAssignments_Active_End_State", "([IsActive] = 1 AND [EndedAt] IS NULL AND [EndedByUserId] IS NULL) OR ([IsActive] = 0 AND [EndedAt] IS NOT NULL)");
                    table.CheckConstraint("CK_ManagerAssignments_EndedAt_After_AssignedAt", "[EndedAt] IS NULL OR [EndedAt] >= [AssignedAt]");
                    table.ForeignKey(
                        name: "FK_ManagerAssignments_Buildings_BuildingId",
                        column: x => x.BuildingId,
                        principalTable: "Buildings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ManagerAssignments_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ManagerAssignments_Users_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ManagerAssignments_Users_EndedByUserId",
                        column: x => x.EndedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ManagerAssignments_Users_ManagerUserId",
                        column: x => x.ManagerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ManagerAssignments_AssignedByUserId",
                table: "ManagerAssignments",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerAssignments_BuildingId_IsActive",
                table: "ManagerAssignments",
                columns: new[] { "BuildingId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_ManagerAssignments_EndedByUserId",
                table: "ManagerAssignments",
                column: "EndedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerAssignments_ManagerUserId_BuildingId",
                table: "ManagerAssignments",
                columns: new[] { "ManagerUserId", "BuildingId" },
                unique: true,
                filter: "[IsActive] = 1 AND [BuildingId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerAssignments_ManagerUserId_IsActive",
                table: "ManagerAssignments",
                columns: new[] { "ManagerUserId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_ManagerAssignments_ManagerUserId_PropertyId",
                table: "ManagerAssignments",
                columns: new[] { "ManagerUserId", "PropertyId" },
                unique: true,
                filter: "[IsActive] = 1 AND [BuildingId] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerAssignments_PropertyId_IsActive",
                table: "ManagerAssignments",
                columns: new[] { "PropertyId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ManagerAssignments");
        }
    }
}
