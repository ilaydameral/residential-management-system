using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments", table =>
        {
            table.HasCheckConstraint(
                "CK_Payments_Amount_Positive",
                "[Amount] > 0");
        });

        builder.Property(p => p.Amount)
            .HasColumnType("decimal(18,2)");

        builder.HasOne(p => p.UnitCharge)
            .WithMany(uc => uc.Payments)
            .HasForeignKey(p => p.UnitChargeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.PaymentSubmission)
            .WithMany()
            .HasForeignKey(p => p.PaymentSubmissionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.PayerUser)
            .WithMany()
            .HasForeignKey(p => p.PayerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.CreatedByUser)
            .WithMany()
            .HasForeignKey(p => p.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.CancelledByUser)
            .WithMany()
            .HasForeignKey(p => p.CancelledByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => p.PaymentSubmissionId)
            .IsUnique()
            .HasFilter("[PaymentSubmissionId] IS NOT NULL");

        builder.HasIndex(p => new { p.UnitChargeId, p.IsCancelled });
        builder.HasIndex(p => p.PayerUserId);
    }
}
