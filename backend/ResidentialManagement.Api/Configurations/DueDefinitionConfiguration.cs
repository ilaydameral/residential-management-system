using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class DueDefinitionConfiguration : IEntityTypeConfiguration<DueDefinition>
{
    public void Configure(EntityTypeBuilder<DueDefinition> builder)
    {
        builder.ToTable("DueDefinitions", table =>
        {
            table.HasCheckConstraint(
                "CK_DueDefinitions_Amount_Positive",
                "[Amount] > 0");

            table.HasCheckConstraint(
                "CK_DueDefinitions_DueDay_Range",
                "[DueDay] >= 1 AND [DueDay] <= 28");
        });

        builder.Property(dd => dd.Amount)
            .HasColumnType("decimal(18,2)");

        builder.HasOne(dd => dd.Property)
            .WithMany()
            .HasForeignKey(dd => dd.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(dd => dd.Building)
            .WithMany()
            .HasForeignKey(dd => dd.BuildingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(dd => dd.CreatedByUser)
            .WithMany()
            .HasForeignKey(dd => dd.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(dd => dd.UpdatedByUser)
            .WithMany()
            .HasForeignKey(dd => dd.UpdatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(dd => dd.PropertyId);
        builder.HasIndex(dd => dd.BuildingId);
    }
}
