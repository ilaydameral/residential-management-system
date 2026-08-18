using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddImportInfrastructure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImportBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImportType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    StorageKey = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FileHashSha256 = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TotalRows = table.Column<int>(type: "int", nullable: false),
                    ValidRows = table.Column<int>(type: "int", nullable: false),
                    InvalidRows = table.Column<int>(type: "int", nullable: false),
                    ImportedRows = table.Column<int>(type: "int", nullable: false),
                    SkippedRows = table.Column<int>(type: "int", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ValidatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RolledBackAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ErrorMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportBatches", x => x.Id);
                    table.CheckConstraint("CK_ImportBatches_ImportType_Allowed", "[ImportType] IN ('PROPERTIES', 'BUILDINGS', 'UNITS', 'USERS', 'OCCUPANCIES', 'DUE_CHARGES', 'EXPENSES')");
                    table.CheckConstraint("CK_ImportBatches_Status_Allowed", "[Status] IN ('UPLOADED', 'VALIDATED', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'ROLLED_BACK')");
                    table.ForeignKey(
                        name: "FK_ImportBatches_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ImportRowLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImportBatchId = table.Column<int>(type: "int", nullable: false),
                    RowNumber = table.Column<int>(type: "int", nullable: false),
                    RawDataJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ActionPreview = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ErrorMessagesJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedEntityId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportRowLogs", x => x.Id);
                    table.CheckConstraint("CK_ImportRowLogs_ActionPreview_Allowed", "[ActionPreview] IN ('CREATE', 'SKIP', 'ERROR')");
                    table.CheckConstraint("CK_ImportRowLogs_Status_Allowed", "[Status] IN ('PENDING', 'VALID', 'INVALID', 'SKIPPED', 'IMPORTED', 'ERROR')");
                    table.ForeignKey(
                        name: "FK_ImportRowLogs_ImportBatches_ImportBatchId",
                        column: x => x.ImportBatchId,
                        principalTable: "ImportBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_CreatedAt",
                table: "ImportBatches",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_CreatedByUserId",
                table: "ImportBatches",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_FileHashSha256",
                table: "ImportBatches",
                column: "FileHashSha256");

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_Status",
                table: "ImportBatches",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ImportRowLogs_ImportBatchId",
                table: "ImportRowLogs",
                column: "ImportBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportRowLogs_ImportBatchId_RowNumber",
                table: "ImportRowLogs",
                columns: new[] { "ImportBatchId", "RowNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_ImportRowLogs_Status",
                table: "ImportRowLogs",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportRowLogs");

            migrationBuilder.DropTable(
                name: "ImportBatches");
        }
    }
}
