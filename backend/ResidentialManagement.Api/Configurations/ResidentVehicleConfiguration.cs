using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class ResidentVehicleConfiguration : IEntityTypeConfiguration<ResidentVehicle>
{
    public void Configure(EntityTypeBuilder<ResidentVehicle> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.PlateNumber)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(v => v.VehicleType)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(v => v.BrandModel)
            .HasMaxLength(100);

        builder.Property(v => v.Color)
            .HasMaxLength(50);

        builder.HasOne(v => v.ResidentUser)
            .WithMany()
            .HasForeignKey(v => v.ResidentUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(v => v.Unit)
            .WithMany()
            .HasForeignKey(v => v.UnitId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(v => new { v.UnitId, v.IsActive });

        builder.HasIndex(v => new { v.ResidentUserId, v.IsActive });

        // Filtered unique index: PlateNumber unique where IsActive = 1
        builder.HasIndex(v => v.PlateNumber)
            .IsUnique()
            .HasFilter("[IsActive] = 1");
    }
}
