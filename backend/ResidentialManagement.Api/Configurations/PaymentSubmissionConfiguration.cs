using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class PaymentSubmissionConfiguration : IEntityTypeConfiguration<PaymentSubmission>
{
    public void Configure(EntityTypeBuilder<PaymentSubmission> builder)
    {
        builder.ToTable("PaymentSubmissions", table =>
        {
            table.HasCheckConstraint(
                "CK_PaymentSubmissions_Amount_Positive",
                "[Amount] > 0");

            table.HasCheckConstraint(
                "CK_PaymentSubmissions_Status_Allowed",
                "[Status] IN ('PENDING', 'APPROVED', 'REJECTED')");
        });

        builder.Property(ps => ps.Amount)
            .HasColumnType("decimal(18,2)");

        builder.HasOne(ps => ps.UnitCharge)
            .WithMany(uc => uc.PaymentSubmissions)
            .HasForeignKey(ps => ps.UnitChargeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(ps => ps.SubmittedByUser)
            .WithMany()
            .HasForeignKey(ps => ps.SubmittedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(ps => ps.ReviewedByUser)
            .WithMany()
            .HasForeignKey(ps => ps.ReviewedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(ps => ps.UnitChargeId);
        builder.HasIndex(ps => ps.SubmittedByUserId);
        builder.HasIndex(ps => ps.Status);
    }
}
