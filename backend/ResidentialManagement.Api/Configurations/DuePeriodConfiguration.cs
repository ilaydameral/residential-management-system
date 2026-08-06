using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class DuePeriodConfiguration : IEntityTypeConfiguration<DuePeriod>
{
    public void Configure(EntityTypeBuilder<DuePeriod> builder)
    {
        builder.ToTable("DuePeriods", table =>
        {
            table.HasCheckConstraint(
                "CK_DuePeriods_Year_Range",
                "[Year] >= 2020 AND [Year] <= 2100");

            table.HasCheckConstraint(
                "CK_DuePeriods_Month_Range",
                "[Month] >= 1 AND [Month] <= 12");

            table.HasCheckConstraint(
                "CK_DuePeriods_Status_Allowed",
                "[Status] IN ('DRAFT', 'ISSUED', 'CANCELLED')");
        });

        builder.HasOne(dp => dp.DueDefinition)
            .WithMany(dd => dd.DuePeriods)
            .HasForeignKey(dp => dp.DueDefinitionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(dp => dp.IssuedByUser)
            .WithMany()
            .HasForeignKey(dp => dp.IssuedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(dp => dp.CancelledByUser)
            .WithMany()
            .HasForeignKey(dp => dp.CancelledByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(dp => dp.CreatedByUser)
            .WithMany()
            .HasForeignKey(dp => dp.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(dp => new { dp.DueDefinitionId, dp.Year, dp.Month })
            .IsUnique()
            .HasFilter("[Status] <> 'CANCELLED'");
    }
}
