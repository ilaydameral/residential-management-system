using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class MaintenanceRequestHistoryConfiguration : IEntityTypeConfiguration<MaintenanceRequestHistory>
{
    public void Configure(EntityTypeBuilder<MaintenanceRequestHistory> builder)
    {
        builder.ToTable("MaintenanceRequestHistories", table =>
        {
            table.HasCheckConstraint(
                "CK_MaintenanceRequestHistories_ActionType_Allowed",
                "[ActionType] IN ('CREATED', 'ASSIGNED', 'PRIORITY_CHANGED', 'STATUS_CHANGED', 'NOTE_ADDED', 'CANCELLED', 'REOPENED', 'RESOLVED', 'CLOSED')");
        });

        builder.Property(mrh => mrh.ActionType)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(mrh => mrh.OldStatus)
            .HasMaxLength(30);

        builder.Property(mrh => mrh.NewStatus)
            .HasMaxLength(30);

        builder.Property(mrh => mrh.Note)
            .HasMaxLength(1000);

        builder.HasOne(mrh => mrh.MaintenanceRequest)
            .WithMany(mr => mr.Histories)
            .HasForeignKey(mrh => mrh.MaintenanceRequestId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mrh => mrh.OldAssignedToUser)
            .WithMany()
            .HasForeignKey(mrh => mrh.OldAssignedToUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mrh => mrh.NewAssignedToUser)
            .WithMany()
            .HasForeignKey(mrh => mrh.NewAssignedToUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mrh => mrh.ChangedByUser)
            .WithMany()
            .HasForeignKey(mrh => mrh.ChangedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(mrh => new { mrh.MaintenanceRequestId, mrh.CreatedAt });
        builder.HasIndex(mrh => mrh.ChangedByUserId);
    }
}
