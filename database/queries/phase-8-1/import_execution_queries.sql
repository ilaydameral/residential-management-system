-- ==============================================================================
-- Document: Phase 8.1 Import Execution, Reconciliation and Rollback Audit Queries
-- ==============================================================================

USE ApartmentManagementDb;
GO

PRINT '=============================================================================';
PRINT '1. Completed and Rolled-Back Batches Audit Summary';
PRINT '=============================================================================';

SELECT
    ib.Id AS BatchId,
    ib.ImportType,
    ib.OriginalFileName,
    ib.Status,
    ib.TotalRows,
    ib.ValidRows,
    ib.ImportedRows,
    ib.SkippedRows,
    ib.InvalidRows,
    (u.FirstName + ' ' + u.LastName) AS ExecutedBy,
    ib.CreatedAt,
    ib.CompletedAt,
    ib.RolledBackAt,
    ib.ErrorMessage
FROM dbo.ImportBatches ib
INNER JOIN dbo.Users u ON ib.CreatedByUserId = u.Id
WHERE ib.Status IN ('COMPLETED', 'ROLLED_BACK', 'FAILED', 'IMPORTING')
ORDER BY ib.Id DESC;

PRINT '=============================================================================';
PRINT '2. Reconciliation & Created Entity Audit for Target Batch';
PRINT '=============================================================================';

DECLARE @TargetBatchId INT = 1; -- Replace with target BatchId

SELECT
    irl.RowNumber,
    irl.Status,
    irl.ActionPreview,
    irl.CreatedEntityId,
    irl.RawDataJson
FROM dbo.ImportRowLogs irl
WHERE irl.ImportBatchId = @TargetBatchId
  AND irl.CreatedEntityId IS NOT NULL
ORDER BY irl.RowNumber ASC;

PRINT '=============================================================================';
PRINT '3. Failed or Stale Validation Batches Inspection';
PRINT '=============================================================================';

SELECT
    ib.Id AS BatchId,
    ib.ImportType,
    ib.Status,
    ib.ErrorMessage,
    ib.CreatedAt,
    ib.ValidatedAt
FROM dbo.ImportBatches ib
WHERE ib.Status = 'FAILED'
ORDER BY ib.Id DESC;
GO
