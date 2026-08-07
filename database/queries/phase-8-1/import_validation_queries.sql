-- ==============================================================================
-- Document: Phase 8.1 Data Import Validation & Preview Inspection Queries
-- Note: Read-only queries for inspecting ImportBatches status, row logs,
-- validation error codes, and duplicate action previews.
-- ==============================================================================

USE ApartmentManagementDb;
GO

PRINT '=============================================================================';
PRINT '1. Import Batches Summary by Status and ImportType';
PRINT '=============================================================================';

SELECT
    ib.Id AS BatchId,
    ib.ImportType,
    ib.OriginalFileName,
    ib.Status,
    ib.TotalRows,
    ib.ValidRows,
    ib.InvalidRows,
    ib.SkippedRows,
    ib.ImportedRows,
    (u.FirstName + ' ' + u.LastName) AS CreatedByUserName,
    ib.CreatedAt,
    ib.ValidatedAt
FROM dbo.ImportBatches ib
INNER JOIN dbo.Users u ON ib.CreatedByUserId = u.Id
ORDER BY ib.Id DESC;

PRINT '=============================================================================';
PRINT '2. Row Validation Action Breakdown for Target Batch';
PRINT '=============================================================================';

DECLARE @TargetBatchId INT = 1; -- Replace with target BatchId

SELECT
    irl.ActionPreview,
    irl.Status,
    COUNT(irl.Id) AS RowCount
FROM dbo.ImportRowLogs irl
WHERE irl.ImportBatchId = @TargetBatchId
GROUP BY irl.ActionPreview, irl.Status
ORDER BY irl.ActionPreview, irl.Status;

PRINT '=============================================================================';
PRINT '3. Detailed Invalid or Skipped Rows Log Inspection';
PRINT '=============================================================================';

SELECT TOP 50
    irl.RowNumber,
    irl.Status,
    irl.ActionPreview,
    irl.RawDataJson,
    irl.ErrorMessagesJson
FROM dbo.ImportRowLogs irl
WHERE irl.ImportBatchId = @TargetBatchId
  AND (irl.Status IN ('INVALID', 'SKIPPED') OR irl.ActionPreview IN ('ERROR', 'SKIP'))
ORDER BY irl.RowNumber ASC;
GO
