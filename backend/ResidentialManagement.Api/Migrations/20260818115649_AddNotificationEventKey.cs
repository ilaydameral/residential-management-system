using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationEventKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId",
                table: "Notifications");

            migrationBuilder.AddColumn<string>(
                name: "EventKey",
                table: "Notifications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId",
                table: "Notifications",
                columns: new[] { "UserId", "NotificationType", "RelatedEntityName", "RelatedEntityId" },
                unique: true,
                filter: "[RelatedEntityName] IS NOT NULL AND [RelatedEntityId] IS NOT NULL AND [EventKey] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId_EventKey",
                table: "Notifications",
                columns: new[] { "UserId", "NotificationType", "RelatedEntityName", "RelatedEntityId", "EventKey" },
                unique: true,
                filter: "[RelatedEntityName] IS NOT NULL AND [RelatedEntityId] IS NOT NULL AND [EventKey] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId_EventKey",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "EventKey",
                table: "Notifications");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId",
                table: "Notifications",
                columns: new[] { "UserId", "NotificationType", "RelatedEntityName", "RelatedEntityId" },
                unique: true,
                filter: "[RelatedEntityName] IS NOT NULL AND [RelatedEntityId] IS NOT NULL");
        }
    }
}
