using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class AnnouncementConfiguration : IEntityTypeConfiguration<Announcement>
{
    public void Configure(EntityTypeBuilder<Announcement> builder)
    {
        builder.ToTable("Announcements", table =>
        {
            table.HasCheckConstraint(
                "CK_Announcements_Status_Allowed",
                "[Status] IN ('DRAFT', 'PUBLISHED', 'CANCELLED')");

            table.HasCheckConstraint(
                "CK_Announcements_Priority_Allowed",
                "[Priority] IN ('NORMAL', 'IMPORTANT', 'URGENT')");
        });

        builder.Property(a => a.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(a => a.Priority)
            .HasMaxLength(30)
            .HasDefaultValue("NORMAL")
            .IsRequired();

        builder.Property(a => a.Status)
            .HasMaxLength(30)
            .HasDefaultValue("DRAFT")
            .IsRequired();

        builder.HasOne(a => a.Property)
            .WithMany()
            .HasForeignKey(a => a.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.Building)
            .WithMany()
            .HasForeignKey(a => a.BuildingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.CreatedByUser)
            .WithMany()
            .HasForeignKey(a => a.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => a.PropertyId);
        builder.HasIndex(a => a.BuildingId);
        builder.HasIndex(a => a.Status);
        builder.HasIndex(a => a.PublishedAt);
        builder.HasIndex(a => new { a.PropertyId, a.Status });
        builder.HasIndex(a => new { a.BuildingId, a.Status });
    }
}
