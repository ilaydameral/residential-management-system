using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Configurations;

public class ImportRowLogConfiguration : IEntityTypeConfiguration<ImportRowLog>
{
    public void Configure(EntityTypeBuilder<ImportRowLog> builder)
    {
        builder.ToTable("ImportRowLogs", table =>
        {
            table.HasCheckConstraint(
                "CK_ImportRowLogs_Status_Allowed",
                "[Status] IN ('PENDING', 'VALID', 'INVALID', 'SKIPPED', 'IMPORTED', 'ERROR')");

            table.HasCheckConstraint(
                "CK_ImportRowLogs_ActionPreview_Allowed",
                "[ActionPreview] IN ('CREATE', 'SKIP', 'ERROR')");
        });

        builder.HasOne(irl => irl.ImportBatch)
            .WithMany(ib => ib.RowLogs)
            .HasForeignKey(irl => irl.ImportBatchId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(irl => irl.ImportBatchId);
        builder.HasIndex(irl => new { irl.ImportBatchId, irl.RowNumber });
        builder.HasIndex(irl => irl.Status);
    }
}
