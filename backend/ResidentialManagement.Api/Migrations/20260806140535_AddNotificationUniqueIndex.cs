using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsDismissed_IsRead",
                table: "Notifications",
                columns: new[] { "UserId", "IsDismissed", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId",
                table: "Notifications",
                columns: new[] { "UserId", "NotificationType", "RelatedEntityName", "RelatedEntityId" },
                unique: true,
                filter: "[RelatedEntityName] IS NOT NULL AND [RelatedEntityId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_IsDismissed_IsRead",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_NotificationType_RelatedEntityName_RelatedEntityId",
                table: "Notifications");
        }
    }
}
