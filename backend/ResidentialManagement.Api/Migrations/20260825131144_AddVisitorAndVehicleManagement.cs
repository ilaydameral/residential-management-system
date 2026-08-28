using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVisitorAndVehicleManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ResidentVehicles",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ResidentUserId = table.Column<int>(type: "int", nullable: false),
                    UnitId = table.Column<int>(type: "int", nullable: false),
                    PlateNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    VehicleType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    BrandModel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Color = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResidentVehicles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResidentVehicles_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ResidentVehicles_Users_ResidentUserId",
                        column: x => x.ResidentUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Visitors",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    HostUserId = table.Column<int>(type: "int", nullable: false),
                    UnitId = table.Column<int>(type: "int", nullable: false),
                    VisitorName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    VisitorPhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    VisitorType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    VehiclePlate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ExpectedArrival = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpectedDeparture = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AccessCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CheckedInAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CheckedInByUserId = table.Column<int>(type: "int", nullable: true),
                    CheckedOutAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Visitors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Visitors_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visitors_Users_CheckedInByUserId",
                        column: x => x.CheckedInByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visitors_Users_HostUserId",
                        column: x => x.HostUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResidentVehicles_PlateNumber",
                table: "ResidentVehicles",
                column: "PlateNumber",
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_ResidentVehicles_ResidentUserId_IsActive",
                table: "ResidentVehicles",
                columns: new[] { "ResidentUserId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_ResidentVehicles_UnitId_IsActive",
                table: "ResidentVehicles",
                columns: new[] { "UnitId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_AccessCode",
                table: "Visitors",
                column: "AccessCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_CheckedInByUserId",
                table: "Visitors",
                column: "CheckedInByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_HostUserId_ExpectedArrival",
                table: "Visitors",
                columns: new[] { "HostUserId", "ExpectedArrival" });

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_UnitId_Status_ExpectedArrival",
                table: "Visitors",
                columns: new[] { "UnitId", "Status", "ExpectedArrival" });

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_VehiclePlate",
                table: "Visitors",
                column: "VehiclePlate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResidentVehicles");

            migrationBuilder.DropTable(
                name: "Visitors");
        }
    }
}
