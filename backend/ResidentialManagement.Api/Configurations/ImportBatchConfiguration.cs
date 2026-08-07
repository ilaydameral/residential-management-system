using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class ImportBatchConfiguration : IEntityTypeConfiguration<ImportBatch>
{
    public void Configure(EntityTypeBuilder<ImportBatch> builder)
    {
        builder.ToTable("ImportBatches", table =>
        {
            table.HasCheckConstraint(
                "CK_ImportBatches_Status_Allowed",
                "[Status] IN ('UPLOADED', 'VALIDATED', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'ROLLED_BACK')");

            table.HasCheckConstraint(
                "CK_ImportBatches_ImportType_Allowed",
                "[ImportType] IN ('PROPERTIES', 'BUILDINGS', 'UNITS', 'USERS', 'OCCUPANCIES', 'DUE_CHARGES', 'EXPENSES')");
        });

        builder.HasOne(ib => ib.CreatedByUser)
            .WithMany()
            .HasForeignKey(ib => ib.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(ib => ib.CreatedByUserId);
        builder.HasIndex(ib => ib.Status);
        builder.HasIndex(ib => ib.CreatedAt);
        builder.HasIndex(ib => ib.FileHashSha256);
    }
}
