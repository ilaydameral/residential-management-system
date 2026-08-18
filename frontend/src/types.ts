export interface PropertyType {
  id: number
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface UnitType {
  id: number
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface Property {
  id: number
  name: string
  propertyTypeId?: number | null
  propertyType: string
  propertyTypeName?: string | null
  addressLine: string
  city: string
  district: string
  description: string | null
  isActive: boolean
  buildingCount: number
  unitCount: number
  createdAt: string
}

export interface CreatePropertyPayload {
  name: string
  propertyTypeId?: number | null
  propertyType?: string | null
  addressLine: string
  city: string
  district: string
  description?: string | null
}

export interface UpdatePropertyPayload {
  name: string
  propertyTypeId?: number | null
  propertyType?: string | null
  addressLine: string
  city: string
  district: string
  description?: string | null
  isActive: boolean
}

export interface Building {
  id: number
  propertyId: number
  propertyName: string
  name: string
  code: string
  floorCount: number
  description: string | null
  isActive: boolean
  unitCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateBuildingPayload {
  propertyId: number
  name: string
  code: string
  floorCount: number
  description?: string | null
}

export interface UpdateBuildingPayload {
  propertyId: number
  name: string
  code: string
  floorCount: number
  description?: string | null
  isActive: boolean
}

export interface Unit {
  id: number
  buildingId: number
  buildingName: string
  propertyId: number
  propertyName: string
  unitTypeId: number
  unitTypeName: string
  unitTypeCode: string
  unitNumber: string
  floorNumber: number
  grossArea: number | null
  netArea: number | null
  description: string | null
  isActive: boolean
  activeOccupancyCount: number
  createdAt: string
  updatedAt: string | null
}

export interface ResidentUnit {
  unitId: number
  propertyName: string
  buildingName: string
  unitNumber: string
  floorNumber: number
  unitTypeName: string
  grossArea: number | null
  netArea: number | null
  occupancyType: OccupancyTypeCode
  isPrimary: boolean
  startDate: string
}

export interface AccountProfile {
  id: number
  fullName: string
  userName?: string | null
  email: string
  roles: string[]
  isActive: boolean
  createdAt: string
}

export interface UpdateAccountProfilePayload {
  fullName: string
}

export interface ChangeAccountPasswordPayload {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export interface CreateUnitPayload {
  buildingId: number
  unitTypeId: number
  unitNumber: string
  floorNumber: number
  grossArea?: number | null
  netArea?: number | null
  description?: string | null
}

export interface UpdateUnitPayload {
  buildingId: number
  unitTypeId: number
  unitNumber: string
  floorNumber: number
  grossArea?: number | null
  netArea?: number | null
  description?: string | null
  isActive: boolean
}

export type OccupancyTypeCode = 'OWNER' | 'TENANT' | 'HOUSEHOLD_MEMBER'

export interface OccupancyType {
  id: number
  code: OccupancyTypeCode
  name: string
}

export interface UnitOccupancy {
  id: number
  userId: number
  userName: string
  userFullName: string
  userEmail: string
  unitId: number
  unitNumber: string
  buildingId: number
  buildingName: string
  propertyId: number
  propertyName: string
  occupancyTypeId: number
  occupancyTypeCode: OccupancyTypeCode
  occupancyTypeName: string
  startDate: string
  endDate: string | null
  isActive: boolean
  isPrimary: boolean
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

export interface UserSearchResult {
  id: number
  fullName: string
  email: string
  isActive: boolean
}

export interface ManagedUser {
  id: number
  fullName: string
  email: string
  roles: string[]
  isActive: boolean
  activeUnitCount: number
  createdAt: string
}

export interface ManagedUserDetail {
  id: number
  firstName: string
  lastName: string
  email: string
  roles: string[]
  isActive: boolean
}

export interface Role {
  id: number
  code: string
  name: string
  isActive: boolean
}

export interface CreateManagedUserPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  roleCodes: string[]
  isActive: boolean
}

export interface UpdateManagedUserPayload {
  firstName: string
  lastName: string
  email: string
}

export interface UpdateUserRolesPayload {
  roleCodes: string[]
}

export interface CreateUnitOccupancyPayload {
  userId: number
  occupancyTypeId: number
  startDate: string
  endDate: string | null
  isPrimary: boolean
  notes: string | null
}

export interface UpdateUnitOccupancyPayload {
  occupancyTypeId: number
  startDate: string
  endDate: string | null
  isPrimary: boolean
  notes: string | null
}

export interface EndUnitOccupancyPayload {
  endDate: string
}

export interface LoginRequest {
  userNameOrEmail: string
  password: string
}

export interface RegisterRequest {
  userName: string
  email: string
  password: string
  firstName: string
  lastName: string
}


export interface AuthenticatedUser {
  id: number
  userName: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
}

export interface LoginResponse {
  accessToken: string
  expiresAtUtc: string
  user: AuthenticatedUser
}

export interface ApiErrorResponse {
  statusCode?: number
  message?: string
  details?: string | null
  errors?: Record<string, string[]>
}

export interface DashboardSummary {
  propertyCount: number
  buildingCount: number
  unitCount: number
  activeOccupancyCount: number
  occupiedUnitCount: number
  vacantUnitCount: number
}

export interface ManagerAssignment {
  id: number
  managerUserId: number
  managerUserName: string
  managerFullName: string
  managerEmail: string
  propertyId: number
  propertyName: string
  buildingId: number | null
  buildingName: string | null
  buildingCode: string | null
  scopeType: 'PROPERTY' | 'BUILDING'
  assignedAt: string
  assignedByUserId: number
  assignedByFullName: string
  isActive: boolean
  endedAt: string | null
  endedByUserId: number | null
  endedByFullName: string | null
  endReason: string | null
}

export interface CreateManagerAssignmentPayload {
  managerUserId: number
  propertyId: number
  buildingId: number | null
}

export interface EndManagerAssignmentPayload {
  endReason: string | null
}

// ============================================================================
// Phase 8: Financial Management DTOs
// ============================================================================

export interface NotificationDto {
  id: number
  userId: number
  title: string
  message: string
  notificationType: string
  relatedEntityName: string | null
  relatedEntityId: number | null
  isRead: boolean
  readAt: string | null
  isDismissed: boolean
  dismissedAt: string | null
  createdAt: string
}

export interface UnreadNotificationCountDto {
  unreadCount: number
}

export interface ManagementFinanceSummaryDto {
  totalCharged: number
  totalPaid: number
  totalOutstanding: number
  overdueAmount: number
  pendingSubmissionCount: number
  totalUnitsCount: number
  overdueUnitCount: number
}

export interface MonthlyCollectionSummaryDto {
  year: number
  month: number
  periodName: string
  totalCharged: number
  totalCollected: number
  outstandingBalance: number
  collectionPercentage: number
  cumulativeCollectionPercentage: number
}

export interface UnitOutstandingReportDto {
  unitId: number
  unitNumber: string
  buildingName: string
  propertyName: string
  totalCharged: number
  totalPaid: number
  remainingBalance: number
  overdueChargeCount: number
}

export interface ResidentFinanceSummaryDto {
  totalCharged: number
  totalPaid: number
  totalOutstanding: number
  overdueChargeCount: number
  pendingSubmissionCount: number
  activeOccupancyUnitCount: number
}

export interface DueDefinition {
  id: number
  propertyId: number
  propertyName: string
  buildingId: number | null
  buildingName: string | null
  title: string
  description: string | null
  amount: number
  dueDay: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateDueDefinitionPayload {
  propertyId: number
  buildingId: number | null
  title: string
  description?: string | null
  amount: number
  dueDay: number
}

export interface UpdateDueDefinitionPayload {
  title: string
  description?: string | null
  amount: number
  dueDay: number
}

export interface DuePeriod {
  id: number
  dueDefinitionId: number
  dueDefinitionTitle: string
  propertyId: number
  propertyName: string
  buildingId: number | null
  buildingName: string | null
  year: number
  month: number
  periodName: string
  unitAmount: number
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED'
  dueDate: string
  issuedAt: string | null
  issuedByFullName?: string | null
  cancelledAt: string | null
  cancelledByFullName?: string | null
  cancellationReason: string | null
  createdAt: string
  createdByFullName?: string | null
}

export interface CreateDraftDuePeriodPayload {
  dueDefinitionId: number
  year: number
  month: number
}

export interface IssuePeriodPreview {
  periodId: number
  periodName: string
  dueDefinitionId: number
  dueDefinitionTitle: string
  propertyId: number
  propertyName: string
  buildingId: number | null
  buildingName: string | null
  targetUnitCount: number
  unitDuesAmount: number
  totalExpectedAmount: number
  dueDate: string
}

export interface IssuePeriodResult {
  periodId: number
  periodName: string
  issuedAt: string
  generatedChargeCount: number
  totalIssuedAmount: number
}

export interface IssuePeriodResultDto {
  periodId: number
  periodName: string
  issuedChargesCount: number
  totalAmount: number
}

export interface DuePeriodCollectionSummaryDto {
  duePeriodId: number
  periodName: string
  status: string
  dueDate: string
  totalUnitCount: number
  totalAssessedAmount: number
  totalCollectedAmount: number
  totalOutstandingAmount: number
  paidUnitCount: number
  partiallyPaidUnitCount: number
  unpaidUnitCount: number
  overdueUnitCount: number
  pendingSubmissionUnitCount: number
}

export interface DuePeriodUnitCollectionItemDto {
  unitChargeId: number
  unitId: number
  unitNumber: string
  buildingName: string
  propertyName: string
  amount: number
  paidAmount: number
  remainingAmount: number
  pendingSubmissionAmount: number
  hasPendingSubmission: boolean
  status: string
  dueDate: string
}

export interface DuePeriodCollectionDetailsDto {
  summary: DuePeriodCollectionSummaryDto
  units: DuePeriodUnitCollectionItemDto[]
}

export interface CancelDuePeriodPayload {
  cancellationReason: string
}

export interface Expense {
  id: number
  propertyId: number
  propertyName: string
  buildingId: number | null
  buildingName: string | null
  title: string
  category: string
  amount: number
  expenseDate: string
  documentNumber: string | null
  vendorName: string | null
  description: string | null
  attachmentUrl: string | null
  isCancelled: boolean
  cancelledAt: string | null
  cancelledByFullName: string | null
  cancelReason: string | null
  isApportioned: boolean
  apportionedChargeCount: number
  createdAt: string
  createdByFullName: string
  updatedAt: string | null
  updatedByFullName: string | null
}

export interface CreateExpensePayload {
  propertyId: number
  buildingId?: number | null
  title: string
  category: string
  amount: number
  expenseDate: string
  documentNumber?: string | null
  vendorName?: string | null
  description?: string | null
  attachmentUrl?: string | null
}

export interface UpdateExpensePayload {
  title: string
  category: string
  amount: number
  expenseDate: string
  documentNumber?: string | null
  vendorName?: string | null
  description?: string | null
  attachmentUrl?: string | null
}

export interface CancelExpensePayload {
  cancelReason: string
}

export interface ManualUnitApportionmentItem {
  unitId: number
  amount: number
}

export interface ApportionExpensePayload {
  mode: 'EQUAL_SCOPE' | 'EQUAL_SELECTED' | 'MANUAL_SELECTED'
  selectedUnitIds?: number[]
  manualUnitApportionments?: ManualUnitApportionmentItem[]
  dueDate: string
}

export interface ExpenseApportionmentPreviewItem {
  unitId: number
  buildingName: string
  unitNumber: string
  amount: number
}

export interface ExpenseApportionmentPreview {
  expenseId: number
  expenseTitle: string
  expenseAmount: number
  propertyId: number
  propertyName: string
  buildingId: number | null
  buildingName: string | null
  mode: string
  targetUnitCount: number
  totalAllocatedAmount: number
  dueDate: string
  items: ExpenseApportionmentPreviewItem[]
}

export interface ApportionExpenseResult {
  expenseId: number
  expenseTitle: string
  apportionedAt: string
  generatedChargeCount: number
  totalApportionedAmount: number
}

export interface PaymentSubmission {
  id: number
  unitChargeId: number
  unitChargeTitle: string
  unitId: number
  unitNumber: string
  buildingName: string
  propertyName: string
  submittedByUserId: number
  submittedByFullName: string
  amount: number
  paymentDate: string
  paymentMethod: string
  referenceCode: string | null
  receiptAttachmentUrl: string | null
  userNotes: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  reviewedByUserId: number | null
  reviewedByFullName: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  cancelledAt: string | null
  cancelledByFullName: string | null
  createdAt: string
}

export interface ApprovePaymentSubmissionPayload {
  transactionReference?: string | null
  notes?: string | null
}

export interface RejectPaymentSubmissionPayload {
  rejectionReason: string
}

export interface ResidentUnitCharge {
  id: number
  unitId: number
  unitNumber: string
  buildingName: string
  propertyName: string
  title: string
  description: string | null
  amount: number
  paidAmount: number
  remainingAmount: number
  status: 'CANCELLED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'UNPAID'
  dueDate: string
  chargeType: string
  isCancelled: boolean
  createdAt: string
}

export interface ImportBatch {
  id: number
  importType: 'PROPERTIES' | 'BUILDINGS' | 'UNITS' | 'USERS' | 'OCCUPANCIES' | string
  originalFileName: string
  storageKey: string
  fileHashSha256: string
  status: 'UPLOADED' | 'VALIDATED' | 'READY' | 'IMPORTING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK' | string
  totalRows: number
  validRows: number
  invalidRows: number
  importedRows: number
  skippedRows: number
  createdByUserId: number
  createdByFullName: string
  createdAt: string
  validatedAt: string | null
  completedAt: string | null
  rolledBackAt: string | null
  errorMessage: string | null
}

export interface ImportUploadResponse {
  batch: ImportBatch
  isDuplicateUpload: boolean
  duplicateWarning: string | null
}

export interface TargetFieldOption {
  key: string
  label: string
  isRequired: boolean
}

export interface ImportColumnMappingOptions {
  batchId: number
  importType: string
  sourceHeaders: string[]
  allowedTargetFields: TargetFieldOption[]
  suggestedMappings: Record<string, string>
}

export interface ValidateImportBatchPayload {
  columnMappings: Record<string, string>
}

export interface ValidationErrorItem {
  code: string
  field: string
  message: string
}

export interface ImportRowLog {
  id: number
  importBatchId: number
  rowNumber: number
  rawData: Record<string, string>
  mappedValues: Record<string, string>
  status: string
  actionPreview: 'CREATE' | 'SKIP' | 'ERROR' | string
  validationErrors: ValidationErrorItem[]
  createdEntityId: number | null
}

export interface ImportPreviewResponse {
  summary: ImportBatch
  page: number
  pageSize: number
  totalFilteredRows: number
  rows: ImportRowLog[]
}

export interface ImportReconciliation {
  attemptedCreateRows: number
  successfullyCreatedRows: number
  skippedRows: number
  failedRows: number
}

export interface ImportConfirmResponse {
  batch: ImportBatch
  reconciliation: ImportReconciliation
}

export interface ImportSummaryResponse {
  batch: ImportBatch
  reconciliation: ImportReconciliation
  createdEntityIds: number[]
}

export interface ImportRollbackResponse {
  batch: ImportBatch
  isSuccess: boolean
  message: string
  rolledBackRecordCount: number
}

export interface ImportBatchListResponse {
  totalCount: number
  page: number
  pageSize: number
  items: ImportBatch[]
}
