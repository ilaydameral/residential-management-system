using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class MaintenanceRequestConfiguration : IEntityTypeConfiguration<MaintenanceRequest>
{
    public void Configure(EntityTypeBuilder<MaintenanceRequest> builder)
    {
        builder.ToTable("MaintenanceRequests", table =>
        {
            table.HasCheckConstraint(
                "CK_MaintenanceRequests_Status_Allowed",
                "[Status] IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED')");

            table.HasCheckConstraint(
                "CK_MaintenanceRequests_Priority_Allowed",
                "[Priority] IN ('LOW', 'NORMAL', 'HIGH', 'EMERGENCY')");

            table.HasCheckConstraint(
                "CK_MaintenanceRequests_Category_Allowed",
                "[Category] IN ('PLUMBING', 'ELECTRICAL', 'HEATING_COOLING', 'ELEVATOR', 'CLEANING', 'SECURITY', 'STRUCTURAL', 'OTHER')");
        });

        builder.Property(mr => mr.RequestNumber)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(mr => mr.Category)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(mr => mr.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(mr => mr.Priority)
            .HasMaxLength(30)
            .HasDefaultValue("NORMAL")
            .IsRequired();

        builder.Property(mr => mr.Status)
            .HasMaxLength(30)
            .HasDefaultValue("OPEN")
            .IsRequired();

        builder.HasOne(mr => mr.Unit)
            .WithMany()
            .HasForeignKey(mr => mr.UnitId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mr => mr.Property)
            .WithMany()
            .HasForeignKey(mr => mr.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mr => mr.Building)
            .WithMany()
            .HasForeignKey(mr => mr.BuildingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mr => mr.CreatedByUser)
            .WithMany()
            .HasForeignKey(mr => mr.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(mr => mr.AssignedToUser)
            .WithMany()
            .HasForeignKey(mr => mr.AssignedToUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(mr => mr.RequestNumber)
            .IsUnique();

        builder.HasIndex(mr => mr.UnitId);
        builder.HasIndex(mr => mr.PropertyId);
        builder.HasIndex(mr => mr.BuildingId);
        builder.HasIndex(mr => mr.CreatedByUserId);
        builder.HasIndex(mr => mr.AssignedToUserId);
        builder.HasIndex(mr => mr.Status);
        builder.HasIndex(mr => mr.Priority);
        builder.HasIndex(mr => mr.CreatedAt);

        builder.HasIndex(mr => new { mr.PropertyId, mr.Status });
        builder.HasIndex(mr => new { mr.BuildingId, mr.Status });
        builder.HasIndex(mr => new { mr.AssignedToUserId, mr.Status });
    }
}
