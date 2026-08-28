using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class VisitorConfiguration : IEntityTypeConfiguration<Visitor>
{
    public void Configure(EntityTypeBuilder<Visitor> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.VisitorName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(v => v.VisitorPhone)
            .HasMaxLength(20);

        builder.Property(v => v.VisitorType)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(v => v.VehiclePlate)
            .HasMaxLength(20);

        builder.Property(v => v.AccessCode)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(v => v.Status)
            .IsRequired()
            .HasMaxLength(30);

        builder.HasOne(v => v.HostUser)
            .WithMany()
            .HasForeignKey(v => v.HostUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(v => v.Unit)
            .WithMany()
            .HasForeignKey(v => v.UnitId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(v => v.CheckedInByUser)
            .WithMany()
            .HasForeignKey(v => v.CheckedInByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(v => v.AccessCode)
            .IsUnique();

        builder.HasIndex(v => new { v.UnitId, v.Status, v.ExpectedArrival });

        builder.HasIndex(v => new { v.HostUserId, v.ExpectedArrival });

        builder.HasIndex(v => v.VehiclePlate);
    }
}
