using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCommonAreaReservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CommonFacilities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PropertyId = table.Column<int>(type: "int", nullable: false),
                    BuildingId = table.Column<int>(type: "int", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    LocationHint = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    OpeningTime = table.Column<TimeSpan>(type: "time", nullable: false),
                    ClosingTime = table.Column<TimeSpan>(type: "time", nullable: false),
                    SlotDurationMinutes = table.Column<int>(type: "int", nullable: false),
                    RequiresManagerApproval = table.Column<bool>(type: "bit", nullable: false),
                    MaxActiveReservationsPerResident = table.Column<int>(type: "int", nullable: false),
                    CancellationLeadTimeHours = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommonFacilities", x => x.Id);
                    table.CheckConstraint("CK_CommonFacilities_CancellationLeadTime_NonNegative", "[CancellationLeadTimeHours] >= 0");
                    table.CheckConstraint("CK_CommonFacilities_Capacity_Positive", "[Capacity] > 0");
                    table.CheckConstraint("CK_CommonFacilities_MaxActive_Positive", "[MaxActiveReservationsPerResident] > 0");
                    table.CheckConstraint("CK_CommonFacilities_OpeningClosingTime_Valid", "[OpeningTime] < [ClosingTime]");
                    table.CheckConstraint("CK_CommonFacilities_SlotDuration_Positive", "[SlotDurationMinutes] > 0");
                    table.ForeignKey(
                        name: "FK_CommonFacilities_Buildings_BuildingId",
                        column: x => x.BuildingId,
                        principalTable: "Buildings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CommonFacilities_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FacilityMaintenanceBlocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FacilityId = table.Column<int>(type: "int", nullable: false),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityMaintenanceBlocks", x => x.Id);
                    table.CheckConstraint("CK_FacilityMaintenanceBlocks_StartEnd_Valid", "[StartTime] < [EndTime]");
                    table.ForeignKey(
                        name: "FK_FacilityMaintenanceBlocks_CommonFacilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "CommonFacilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityMaintenanceBlocks_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FacilityReservations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FacilityId = table.Column<int>(type: "int", nullable: false),
                    ResidentUserId = table.Column<int>(type: "int", nullable: false),
                    UnitId = table.Column<int>(type: "int", nullable: false),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "PENDING"),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ReviewedByUserId = table.Column<int>(type: "int", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityReservations", x => x.Id);
                    table.CheckConstraint("CK_FacilityReservations_StartEnd_Valid", "[StartTime] < [EndTime]");
                    table.CheckConstraint("CK_FacilityReservations_Status_Allowed", "[Status] IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED')");
                    table.ForeignKey(
                        name: "FK_FacilityReservations_CommonFacilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "CommonFacilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityReservations_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityReservations_Users_ResidentUserId",
                        column: x => x.ResidentUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityReservations_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CommonFacilities_BuildingId",
                table: "CommonFacilities",
                column: "BuildingId");

            migrationBuilder.CreateIndex(
                name: "IX_CommonFacilities_PropertyId_BuildingId_IsActive",
                table: "CommonFacilities",
                columns: new[] { "PropertyId", "BuildingId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMaintenanceBlocks_CreatedByUserId",
                table: "FacilityMaintenanceBlocks",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMaintenanceBlocks_FacilityId_StartTime_EndTime",
                table: "FacilityMaintenanceBlocks",
                columns: new[] { "FacilityId", "StartTime", "EndTime" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReservations_FacilityId_StartTime_EndTime_Status",
                table: "FacilityReservations",
                columns: new[] { "FacilityId", "StartTime", "EndTime", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReservations_ResidentUserId_Status_StartTime",
                table: "FacilityReservations",
                columns: new[] { "ResidentUserId", "Status", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReservations_ReviewedByUserId",
                table: "FacilityReservations",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReservations_UnitId_StartTime",
                table: "FacilityReservations",
                columns: new[] { "UnitId", "StartTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FacilityMaintenanceBlocks");

            migrationBuilder.DropTable(
                name: "FacilityReservations");

            migrationBuilder.DropTable(
                name: "CommonFacilities");
        }
    }
}
