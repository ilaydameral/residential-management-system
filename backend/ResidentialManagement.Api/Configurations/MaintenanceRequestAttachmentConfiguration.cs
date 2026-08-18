using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class MaintenanceRequestAttachmentConfiguration : IEntityTypeConfiguration<MaintenanceRequestAttachment>
{
    public void Configure(EntityTypeBuilder<MaintenanceRequestAttachment> builder)
    {
        builder.ToTable("MaintenanceRequestAttachments");

        builder.Property(mra => mra.OriginalFileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(mra => mra.StorageKey)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(mra => mra.ContentType)
            .HasMaxLength(100)
            .IsRequired();

        builder.HasOne(mra => mra.MaintenanceRequest)
            .WithMany(mr => mr.Attachments)
            .HasForeignKey(mra => mra.MaintenanceRequestId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mra => mra.UploadedByUser)
            .WithMany()
            .HasForeignKey(mra => mra.UploadedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(mra => mra.MaintenanceRequestId);
        builder.HasIndex(mra => mra.UploadedByUserId);
    }
}
