using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class DocumentConfiguration : IEntityTypeConfiguration<Document>
{
    public void Configure(EntityTypeBuilder<Document> builder)
    {
        builder.ToTable("Documents", table =>
        {
            table.HasCheckConstraint(
                "CK_Documents_TargetHierarchy",
                "([BuildingId] IS NULL AND [UnitId] IS NULL) OR " +
                "([BuildingId] IS NOT NULL AND [UnitId] IS NULL) OR " +
                "([BuildingId] IS NOT NULL AND [UnitId] IS NOT NULL)");
            table.HasCheckConstraint(
                "CK_Documents_Category_Allowed",
                "[Category] IN ('GENERAL','MANAGEMENT','FINANCE','MEETING','MAINTENANCE','LEGAL','TECHNICAL','OTHER')");
            table.HasCheckConstraint(
                "CK_Documents_Visibility_Allowed",
                "[Visibility] IN ('MANAGEMENT_ONLY','RESIDENTS')");
            table.HasCheckConstraint("CK_Documents_FileSize_Positive", "[FileSize] > 0");
            table.HasCheckConstraint(
                "CK_Documents_ArchiveState",
                "([IsActive] = 1 AND [ArchivedAt] IS NULL AND [ArchivedByUserId] IS NULL) OR " +
                "([IsActive] = 0 AND [ArchivedAt] IS NOT NULL)");
        });

        builder.HasOne(document => document.Property)
            .WithMany()
            .HasForeignKey(document => document.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(document => document.Building)
            .WithMany()
            .HasForeignKey(document => document.BuildingId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(document => document.Unit)
            .WithMany()
            .HasForeignKey(document => document.UnitId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(document => document.UploadedByUser)
            .WithMany()
            .HasForeignKey(document => document.UploadedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(document => document.ArchivedByUser)
            .WithMany()
            .HasForeignKey(document => document.ArchivedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(document => document.PropertyId);
        builder.HasIndex(document => document.BuildingId);
        builder.HasIndex(document => document.UnitId);
        builder.HasIndex(document => document.IsActive);
        builder.HasIndex(document => document.Category);
        builder.HasIndex(document => document.Visibility);
        builder.HasIndex(document => document.UploadedAt);
        builder.HasIndex(document => new
            {
                document.PropertyId,
                document.BuildingId,
                document.UnitId,
                document.Sha256,
                document.IsActive
            })
            .IsUnique()
            .HasFilter("[IsActive] = 1");
    }
}
