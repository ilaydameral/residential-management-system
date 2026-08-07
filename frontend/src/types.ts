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
