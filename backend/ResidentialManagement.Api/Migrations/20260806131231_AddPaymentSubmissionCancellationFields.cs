using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentSubmissionCancellationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_PaymentSubmissions_Status_Allowed",
                table: "PaymentSubmissions");

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "PaymentSubmissions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CancelledByUserId",
                table: "PaymentSubmissions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaymentSubmissions_CancelledByUserId",
                table: "PaymentSubmissions",
                column: "CancelledByUserId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PaymentSubmissions_Status_Allowed",
                table: "PaymentSubmissions",
                sql: "[Status] IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')");

            migrationBuilder.AddForeignKey(
                name: "FK_PaymentSubmissions_Users_CancelledByUserId",
                table: "PaymentSubmissions",
                column: "CancelledByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PaymentSubmissions_Users_CancelledByUserId",
                table: "PaymentSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_PaymentSubmissions_CancelledByUserId",
                table: "PaymentSubmissions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PaymentSubmissions_Status_Allowed",
                table: "PaymentSubmissions");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "PaymentSubmissions");

            migrationBuilder.DropColumn(
                name: "CancelledByUserId",
                table: "PaymentSubmissions");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PaymentSubmissions_Status_Allowed",
                table: "PaymentSubmissions",
                sql: "[Status] IN ('PENDING', 'APPROVED', 'REJECTED')");
        }
    }
}
