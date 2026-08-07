using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancialEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DueDefinitions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PropertyId = table.Column<int>(type: "int", nullable: false),
                    BuildingId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DueDay = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedByUserId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DueDefinitions", x => x.Id);
                    table.CheckConstraint("CK_DueDefinitions_Amount_Positive", "[Amount] > 0");
                    table.CheckConstraint("CK_DueDefinitions_DueDay_Range", "[DueDay] >= 1 AND [DueDay] <= 28");
                    table.ForeignKey(
                        name: "FK_DueDefinitions_Buildings_BuildingId",
                        column: x => x.BuildingId,
                        principalTable: "Buildings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DueDefinitions_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DueDefinitions_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DueDefinitions_Users_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PropertyId = table.Column<int>(type: "int", nullable: false),
                    BuildingId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ExpenseDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DocumentNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    VendorName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AttachmentUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsCancelled = table.Column<bool>(type: "bit", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelledByUserId = table.Column<int>(type: "int", nullable: true),
                    CancelReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedByUserId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.CheckConstraint("CK_Expenses_Amount_Positive", "[Amount] > 0");
                    table.ForeignKey(
                        name: "FK_Expenses_Buildings_BuildingId",
                        column: x => x.BuildingId,
                        principalTable: "Buildings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Expenses_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Expenses_Users_CancelledByUserId",
                        column: x => x.CancelledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Expenses_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Expenses_Users_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    NotificationType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    RelatedEntityName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RelatedEntityId = table.Column<int>(type: "int", nullable: true),
                    IsRead = table.Column<bool>(type: "bit", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDismissed = table.Column<bool>(type: "bit", nullable: false),
                    DismissedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DuePeriods",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DueDefinitionId = table.Column<int>(type: "int", nullable: false),
                    Year = table.Column<int>(type: "int", nullable: false),
                    Month = table.Column<int>(type: "int", nullable: false),
                    PeriodName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IssuedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IssuedByUserId = table.Column<int>(type: "int", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelledByUserId = table.Column<int>(type: "int", nullable: true),
                    CancellationReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DuePeriods", x => x.Id);
                    table.CheckConstraint("CK_DuePeriods_Month_Range", "[Month] >= 1 AND [Month] <= 12");
                    table.CheckConstraint("CK_DuePeriods_Status_Allowed", "[Status] IN ('DRAFT', 'ISSUED', 'CANCELLED')");
                    table.CheckConstraint("CK_DuePeriods_Year_Range", "[Year] >= 2020 AND [Year] <= 2100");
                    table.ForeignKey(
                        name: "FK_DuePeriods_DueDefinitions_DueDefinitionId",
                        column: x => x.DueDefinitionId,
                        principalTable: "DueDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DuePeriods_Users_CancelledByUserId",
                        column: x => x.CancelledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DuePeriods_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DuePeriods_Users_IssuedByUserId",
                        column: x => x.IssuedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UnitCharges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitId = table.Column<int>(type: "int", nullable: false),
                    DuePeriodId = table.Column<int>(type: "int", nullable: true),
                    ExpenseId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ChargeType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IsCancelled = table.Column<bool>(type: "bit", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelledByUserId = table.Column<int>(type: "int", nullable: true),
                    CancelReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitCharges", x => x.Id);
                    table.CheckConstraint("CK_UnitCharges_Amount_Positive", "[Amount] > 0");
                    table.CheckConstraint("CK_UnitCharges_Source_Consistency", "([ChargeType] = 'DUES' AND [DuePeriodId] IS NOT NULL AND [ExpenseId] IS NULL) OR ([ChargeType] = 'EXPENSE_RECOVERY' AND [ExpenseId] IS NOT NULL AND [DuePeriodId] IS NULL) OR ([ChargeType] = 'MANUAL' AND [DuePeriodId] IS NULL AND [ExpenseId] IS NULL)");
                    table.ForeignKey(
                        name: "FK_UnitCharges_DuePeriods_DuePeriodId",
                        column: x => x.DuePeriodId,
                        principalTable: "DuePeriods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitCharges_Expenses_ExpenseId",
                        column: x => x.ExpenseId,
                        principalTable: "Expenses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitCharges_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitCharges_Users_CancelledByUserId",
                        column: x => x.CancelledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitCharges_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PaymentSubmissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitChargeId = table.Column<int>(type: "int", nullable: false),
                    SubmittedByUserId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ReferenceCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ReceiptAttachmentUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UserNotes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ReviewedByUserId = table.Column<int>(type: "int", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentSubmissions", x => x.Id);
                    table.CheckConstraint("CK_PaymentSubmissions_Amount_Positive", "[Amount] > 0");
                    table.CheckConstraint("CK_PaymentSubmissions_Status_Allowed", "[Status] IN ('PENDING', 'APPROVED', 'REJECTED')");
                    table.ForeignKey(
                        name: "FK_PaymentSubmissions_UnitCharges_UnitChargeId",
                        column: x => x.UnitChargeId,
                        principalTable: "UnitCharges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PaymentSubmissions_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PaymentSubmissions_Users_SubmittedByUserId",
                        column: x => x.SubmittedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitChargeId = table.Column<int>(type: "int", nullable: false),
                    PaymentSubmissionId = table.Column<int>(type: "int", nullable: true),
                    PayerUserId = table.Column<int>(type: "int", nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TransactionReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsCancelled = table.Column<bool>(type: "bit", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelledByUserId = table.Column<int>(type: "int", nullable: true),
                    CancelReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.CheckConstraint("CK_Payments_Amount_Positive", "[Amount] > 0");
                    table.ForeignKey(
                        name: "FK_Payments_PaymentSubmissions_PaymentSubmissionId",
                        column: x => x.PaymentSubmissionId,
                        principalTable: "PaymentSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_UnitCharges_UnitChargeId",
                        column: x => x.UnitChargeId,
                        principalTable: "UnitCharges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_Users_CancelledByUserId",
                        column: x => x.CancelledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_Users_PayerUserId",
                        column: x => x.PayerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DueDefinitions_BuildingId",
                table: "DueDefinitions",
                column: "BuildingId");

            migrationBuilder.CreateIndex(
                name: "IX_DueDefinitions_CreatedByUserId",
                table: "DueDefinitions",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DueDefinitions_PropertyId",
                table: "DueDefinitions",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_DueDefinitions_UpdatedByUserId",
                table: "DueDefinitions",
                column: "UpdatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DuePeriods_CancelledByUserId",
                table: "DuePeriods",
                column: "CancelledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DuePeriods_CreatedByUserId",
                table: "DuePeriods",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DuePeriods_DueDefinitionId_Year_Month",
                table: "DuePeriods",
                columns: new[] { "DueDefinitionId", "Year", "Month" },
                unique: true,
                filter: "[Status] <> 'CANCELLED'");

            migrationBuilder.CreateIndex(
                name: "IX_DuePeriods_IssuedByUserId",
                table: "DuePeriods",
                column: "IssuedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_BuildingId",
                table: "Expenses",
                column: "BuildingId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_CancelledByUserId",
                table: "Expenses",
                column: "CancelledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_CreatedByUserId",
                table: "Expenses",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_ExpenseDate",
                table: "Expenses",
                column: "ExpenseDate");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_PropertyId",
                table: "Expenses",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_UpdatedByUserId",
                table: "Expenses",
                column: "UpdatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsDismissed",
                table: "Notifications",
                columns: new[] { "UserId", "IsDismissed" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsRead",
                table: "Notifications",
                columns: new[] { "UserId", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CancelledByUserId",
                table: "Payments",
                column: "CancelledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CreatedByUserId",
                table: "Payments",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PayerUserId",
                table: "Payments",
                column: "PayerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PaymentSubmissionId",
                table: "Payments",
                column: "PaymentSubmissionId",
                unique: true,
                filter: "[PaymentSubmissionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_UnitChargeId_IsCancelled",
                table: "Payments",
                columns: new[] { "UnitChargeId", "IsCancelled" });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSubmissions_ReviewedByUserId",
                table: "PaymentSubmissions",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSubmissions_Status",
                table: "PaymentSubmissions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSubmissions_SubmittedByUserId",
                table: "PaymentSubmissions",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSubmissions_UnitChargeId",
                table: "PaymentSubmissions",
                column: "UnitChargeId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitCharges_CancelledByUserId",
                table: "UnitCharges",
                column: "CancelledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitCharges_CreatedByUserId",
                table: "UnitCharges",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitCharges_DueDate_IsCancelled",
                table: "UnitCharges",
                columns: new[] { "DueDate", "IsCancelled" });

            migrationBuilder.CreateIndex(
                name: "IX_UnitCharges_DuePeriodId",
                table: "UnitCharges",
                column: "DuePeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitCharges_ExpenseId",
                table: "UnitCharges",
                column: "ExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitCharges_UnitId_DueDate",
                table: "UnitCharges",
                columns: new[] { "UnitId", "DueDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "PaymentSubmissions");

            migrationBuilder.DropTable(
                name: "UnitCharges");

            migrationBuilder.DropTable(
                name: "DuePeriods");

            migrationBuilder.DropTable(
                name: "Expenses");

            migrationBuilder.DropTable(
                name: "DueDefinitions");
        }
    }
}
