using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class UnitChargeConfiguration : IEntityTypeConfiguration<UnitCharge>
{
    public void Configure(EntityTypeBuilder<UnitCharge> builder)
    {
        builder.ToTable("UnitCharges", table =>
        {
            table.HasCheckConstraint(
                "CK_UnitCharges_Amount_Positive",
                "[Amount] > 0");

            table.HasCheckConstraint(
                "CK_UnitCharges_Source_Consistency",
                "([ChargeType] = 'DUES' AND [DuePeriodId] IS NOT NULL AND [ExpenseId] IS NULL) OR ([ChargeType] = 'EXPENSE_RECOVERY' AND [ExpenseId] IS NOT NULL AND [DuePeriodId] IS NULL) OR ([ChargeType] = 'MANUAL' AND [DuePeriodId] IS NULL AND [ExpenseId] IS NULL)");
        });

        builder.Property(uc => uc.Amount)
            .HasColumnType("decimal(18,2)");

        builder.HasOne(uc => uc.Unit)
            .WithMany()
            .HasForeignKey(uc => uc.UnitId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(uc => uc.DuePeriod)
            .WithMany(dp => dp.UnitCharges)
            .HasForeignKey(uc => uc.DuePeriodId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(uc => uc.Expense)
            .WithMany(e => e.UnitCharges)
            .HasForeignKey(uc => uc.ExpenseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(uc => uc.CreatedByUser)
            .WithMany()
            .HasForeignKey(uc => uc.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(uc => uc.CancelledByUser)
            .WithMany()
            .HasForeignKey(uc => uc.CancelledByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(uc => new { uc.UnitId, uc.DueDate });
        builder.HasIndex(uc => new { uc.DueDate, uc.IsCancelled });
        builder.HasIndex(uc => uc.DuePeriodId);
        builder.HasIndex(uc => uc.ExpenseId);
    }
}
