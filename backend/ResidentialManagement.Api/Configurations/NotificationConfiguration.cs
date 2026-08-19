using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");

        builder.HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(n => n.EventKey)
            .HasMaxLength(50);

        builder.HasIndex(n => new { n.UserId, n.IsRead });
        builder.HasIndex(n => new { n.UserId, n.IsDismissed });
        builder.HasIndex(n => new { n.UserId, n.IsDismissed, n.IsRead });

        // Index 1: Legacy / Entity-level notifications (EventKey IS NULL)
        builder.HasIndex(n => new { n.UserId, n.NotificationType, n.RelatedEntityName, n.RelatedEntityId })
            .IsUnique()
            .HasFilter("[RelatedEntityName] IS NOT NULL AND [RelatedEntityId] IS NOT NULL AND [EventKey] IS NULL");

        // Index 2: Lifecycle / Event-level notifications (EventKey IS NOT NULL)
        builder.HasIndex(n => new { n.UserId, n.NotificationType, n.RelatedEntityName, n.RelatedEntityId, n.EventKey })
            .IsUnique()
            .HasFilter("[RelatedEntityName] IS NOT NULL AND [RelatedEntityId] IS NOT NULL AND [EventKey] IS NOT NULL");
    }
}
