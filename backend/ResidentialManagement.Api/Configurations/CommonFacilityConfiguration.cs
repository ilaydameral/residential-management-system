using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class CommonFacilityConfiguration : IEntityTypeConfiguration<CommonFacility>
{
    public void Configure(EntityTypeBuilder<CommonFacility> builder)
    {
        builder.ToTable("CommonFacilities", table =>
        {
            table.HasCheckConstraint("CK_CommonFacilities_Capacity_Positive", "[Capacity] > 0");
            table.HasCheckConstraint("CK_CommonFacilities_SlotDuration_Positive", "[SlotDurationMinutes] > 0");
            table.HasCheckConstraint("CK_CommonFacilities_OpeningClosingTime_Valid", "[OpeningTime] < [ClosingTime]");
            table.HasCheckConstraint("CK_CommonFacilities_MaxActive_Positive", "[MaxActiveReservationsPerResident] > 0");
            table.HasCheckConstraint("CK_CommonFacilities_CancellationLeadTime_NonNegative", "[CancellationLeadTimeHours] >= 0");
        });

        builder.Property(f => f.Name).HasMaxLength(100).IsRequired();
        builder.Property(f => f.Description).HasMaxLength(500);
        builder.Property(f => f.LocationHint).HasMaxLength(200);

        builder.HasOne(f => f.Property)
            .WithMany()
            .HasForeignKey(f => f.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(f => f.Building)
            .WithMany()
            .HasForeignKey(f => f.BuildingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(f => new { f.PropertyId, f.BuildingId, f.IsActive });
    }
}
