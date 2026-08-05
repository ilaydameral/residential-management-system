using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class ManagerAssignmentConfiguration : IEntityTypeConfiguration<ManagerAssignment>
{
    public void Configure(EntityTypeBuilder<ManagerAssignment> builder)
    {
        builder.ToTable("ManagerAssignments", table =>
        {
            table.HasCheckConstraint(
                "CK_ManagerAssignments_Active_End_State",
                "([IsActive] = 1 AND [EndedAt] IS NULL AND [EndedByUserId] IS NULL) OR ([IsActive] = 0 AND [EndedAt] IS NOT NULL)");

            table.HasCheckConstraint(
                "CK_ManagerAssignments_EndedAt_After_AssignedAt",
                "[EndedAt] IS NULL OR [EndedAt] >= [AssignedAt]");
        });

        builder.Property(managerAssignment => managerAssignment.EndReason)
            .HasMaxLength(500);

        builder.HasOne(managerAssignment => managerAssignment.ManagerUser)
            .WithMany()
            .HasForeignKey(managerAssignment => managerAssignment.ManagerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(managerAssignment => managerAssignment.Property)
            .WithMany()
            .HasForeignKey(managerAssignment => managerAssignment.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(managerAssignment => managerAssignment.Building)
            .WithMany()
            .HasForeignKey(managerAssignment => managerAssignment.BuildingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(managerAssignment => managerAssignment.AssignedByUser)
            .WithMany()
            .HasForeignKey(managerAssignment => managerAssignment.AssignedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(managerAssignment => managerAssignment.EndedByUser)
            .WithMany()
            .HasForeignKey(managerAssignment => managerAssignment.EndedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(managerAssignment => new
            {
                managerAssignment.ManagerUserId,
                managerAssignment.PropertyId
            })
            .IsUnique()
            .HasFilter("[IsActive] = 1 AND [BuildingId] IS NULL");

        builder.HasIndex(managerAssignment => new
            {
                managerAssignment.ManagerUserId,
                managerAssignment.BuildingId
            })
            .IsUnique()
            .HasFilter("[IsActive] = 1 AND [BuildingId] IS NOT NULL");

        builder.HasIndex(managerAssignment => new
        {
            managerAssignment.ManagerUserId,
            managerAssignment.IsActive
        });

        builder.HasIndex(managerAssignment => new
        {
            managerAssignment.PropertyId,
            managerAssignment.IsActive
        });

        builder.HasIndex(managerAssignment => new
        {
            managerAssignment.BuildingId,
            managerAssignment.IsActive
        });
    }
}
