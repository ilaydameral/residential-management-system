using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class FacilityReservationConfiguration : IEntityTypeConfiguration<FacilityReservation>
{
    public void Configure(EntityTypeBuilder<FacilityReservation> builder)
    {
        builder.ToTable("FacilityReservations", table =>
        {
            table.HasCheckConstraint("CK_FacilityReservations_StartEnd_Valid", "[StartTime] < [EndTime]");
            table.HasCheckConstraint("CK_FacilityReservations_Status_Allowed", "[Status] IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED')");
        });

        builder.Property(r => r.Status).HasMaxLength(30).HasDefaultValue("PENDING").IsRequired();
        builder.Property(r => r.Note).HasMaxLength(500);
        builder.Property(r => r.RejectionReason).HasMaxLength(500);

        builder.HasOne(r => r.Facility)
            .WithMany(f => f.Reservations)
            .HasForeignKey(r => r.FacilityId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.ResidentUser)
            .WithMany()
            .HasForeignKey(r => r.ResidentUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Unit)
            .WithMany()
            .HasForeignKey(r => r.UnitId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.ReviewedByUser)
            .WithMany()
            .HasForeignKey(r => r.ReviewedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => new { r.FacilityId, r.StartTime, r.EndTime, r.Status });
        builder.HasIndex(r => new { r.ResidentUserId, r.Status, r.StartTime });
        builder.HasIndex(r => new { r.UnitId, r.StartTime });
    }
}
