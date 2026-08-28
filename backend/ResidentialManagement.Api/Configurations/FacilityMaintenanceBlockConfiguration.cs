using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class FacilityMaintenanceBlockConfiguration : IEntityTypeConfiguration<FacilityMaintenanceBlock>
{
    public void Configure(EntityTypeBuilder<FacilityMaintenanceBlock> builder)
    {
        builder.ToTable("FacilityMaintenanceBlocks", table =>
        {
            table.HasCheckConstraint("CK_FacilityMaintenanceBlocks_StartEnd_Valid", "[StartTime] < [EndTime]");
        });

        builder.Property(b => b.Reason).HasMaxLength(250).IsRequired();

        builder.HasOne(b => b.Facility)
            .WithMany(f => f.MaintenanceBlocks)
            .HasForeignKey(b => b.FacilityId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(b => b.CreatedByUser)
            .WithMany()
            .HasForeignKey(b => b.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(b => new { b.FacilityId, b.StartTime, b.EndTime });
    }
}
