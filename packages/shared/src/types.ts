import type { WorkspaceRole } from './enums.js';
import type { WorkspaceSettingsInput } from './schemas.js';

/** API response shapes (DTOs). Only these fields ever leave the API. */

export interface Me {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
  workspaces: { id: string; name: string; role: WorkspaceRole }[];
  tenancies: { workspaceId: string; workspaceName: string; tenantId: string }[];
  canCreateWorkspace: boolean;
  demoMode: boolean;
}

export interface SetupStatus {
  setupNeeded: boolean;
  signupEnabled: boolean;
  demoMode: boolean;
}

export type LoginResult = { status: 'ok' } | { status: 'code'; challenge: string; email: string };

export interface InviteInfo {
  kind: 'MEMBER' | 'TENANT';
  workspaceName: string;
  email: string;
  role: WorkspaceRole | null;
  hasAccount: boolean;
}

export type WorkspaceSettings = Omit<WorkspaceSettingsInput, 'name' | 'contactEmail' | 'contactPhone' | 'address'>;

export interface CurrentWorkspace {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  hasLogo: boolean;
  role: WorkspaceRole;
  settings: WorkspaceSettings;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  isYou: boolean;
}
export interface TeamInvite {
  id: string;
  email: string;
  role: WorkspaceRole | null;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
}
export interface Team {
  members: TeamMember[];
  invites: TeamInvite[];
}

export interface AuditRow {
  id: string;
  action: string;
  targetType: string | null;
  who: string;
  ip: string | null;
  at: string;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  total?: number;
}

// ---------- Portfolio ----------
import type {
  ActorTypeName,
  DocumentType,
  Furnished,
  PropertyStatus,
  PropertyType,
  RtrMethod,
} from './types-enums.js';

export interface UnitSummary {
  id: string;
  name: string;
  /** The current (or next) tenancy, if any. */
  tenancy: { id: string; status: string; tenantNames: string; rentPence: number; frequency: string; endDate: string | null } | null;
}

export interface PropertyListItem {
  id: string;
  address: string;
  addressLine1: string;
  town: string;
  postcode: string;
  type: PropertyType;
  bedrooms: number;
  status: PropertyStatus;
  unitCount: number;
  letUnits: number;
  openRepairs: number;
  hasCover: boolean;
}

export interface PropertyDetail extends PropertyListItem {
  addressLine2: string | null;
  county: string | null;
  bathrooms: number;
  furnished: Furnished;
  hasGas: boolean;
  notes: string | null;
  coverDocId: string | null;
  units: UnitSummary[];
  archived: boolean;
}

export interface RightToRent {
  id: string;
  checkedOn: string;
  method: RtrMethod;
  expiresOn: string | null;
  notes: string | null;
}

export interface TenantListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  currentAddress: string | null;
  portal: 'NONE' | 'INVITED' | 'ACTIVE';
  rightToRentDue: string | null;
  anonymised: boolean;
}

export interface TenantDetail extends TenantListItem {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  notes: string | null;
  rightToRent: RightToRent[];
  tenancies: { id: string; address: string; startDate: string; endDate: string | null; status: string }[];
}

export interface ContractorItem {
  id: string;
  name: string;
  company: string | null;
  trade: string;
  email: string;
  phone: string | null;
  notes: string | null;
  openJobs: number;
}

export interface DocumentItem {
  id: string;
  type: DocumentType;
  title: string;
  mime: string;
  sizeBytes: number;
  issuedOn: string | null;
  expiresOn: string | null;
  sharedWithTenant: boolean;
  ready: boolean;
  uploadedBy: ActorTypeName;
  createdAt: string;
  propertyId: string | null;
  tenancyId: string | null;
  tenantId: string | null;
  repairId: string | null;
}

export interface NoteItem {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  mine: boolean;
}

export interface ActivityItem {
  id: string;
  actorName: string;
  actorType: ActorTypeName;
  action: string;
  summary: string;
  createdAt: string;
  propertyId: string | null;
  tenancyId: string | null;
  tenantId: string | null;
  repairId: string | null;
}

// ---------- Tenancies ----------
export interface TenancyListItem {
  id: string;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDING' | 'ENDED';
  propertyId: string;
  address: string;
  unitName: string;
  tenantNames: string;
  startDate: string;
  endDate: string | null;
  rentPence: number;
  frequency: 'MONTHLY' | 'WEEKLY' | 'FOUR_WEEKLY';
  balancePence: number;
}

export interface RentChangeItem {
  id: string;
  amountPence: number;
  effectiveFrom: string;
  createdAt: string;
}

export interface DepositInfo {
  amountPence: number;
  receivedOn: string | null;
  scheme: 'DPS' | 'TDS' | 'MYDEPOSITS' | 'OTHER' | null;
  schemeReference: string | null;
  protectedOn: string | null;
  prescribedInfoOn: string | null;
  returnedOn: string | null;
  returnedPence: number | null;
  deductions: { id: string; reason: string; amountPence: number }[];
  /** Received but not protected after the workspace's limit. */
  protectionOverdue: boolean;
  protectBy: string | null;
}

export interface GuarantorItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

export interface TenancyDetail extends TenancyListItem {
  unitId: string;
  dueDay: number;
  remindersEnabled: boolean;
  noticeBy: 'TENANT' | 'LANDLORD' | null;
  noticeGivenOn: string | null;
  noticeEndDate: string | null;
  endedOn: string | null;
  tenants: { id: string; name: string; email: string | null; phone: string | null; portal: 'NONE' | 'INVITED' | 'ACTIVE' }[];
  rentChanges: RentChangeItem[];
  deposit: DepositInfo | null;
  guarantors: GuarantorItem[];
  nextDueDate: string | null;
  arrearsPence: number;
  daysOverdue: number;
}

export interface PropertyOption {
  id: string;
  address: string;
  units: { id: string; name: string; tenancy: { id: string; status: string; tenantNames: string; endDate: string | null } | null }[];
}

// ---------- Ledger ----------
export interface LedgerRow {
  id: string;
  type: 'RENT_CHARGE' | 'OTHER_CHARGE' | 'PAYMENT' | 'CREDIT' | 'REVERSAL';
  date: string;
  description: string;
  periodStart: string | null;
  periodEnd: string | null;
  method: 'BANK_TRANSFER' | 'STANDING_ORDER' | 'CASH' | 'CARD' | 'OTHER' | null;
  reference: string | null;
  /** Positive for charges, negative for money in. */
  signedPence: number;
  amountPence: number;
  runningBalancePence: number;
  /** Charges only. */
  status: 'PAID' | 'PART_PAID' | 'UNPAID' | 'UPCOMING' | null;
  outstandingPence: number | null;
  reversed: boolean;
  reversesId: string | null;
  createdBy: string | null;
}

export interface Ledger {
  tenancyId: string;
  rows: LedgerRow[];
  balancePence: number;
  arrearsPence: number;
  daysOverdue: number;
  creditPence: number;
  nextDueDate: string | null;
}

export interface ArrearsItem {
  tenancyId: string;
  tenantNames: string;
  address: string;
  arrearsPence: number;
  daysOverdue: number;
  oldestUnpaidDue: string;
  lastPayment: string | null;
  remindersEnabled: boolean;
}

export interface JobInfo {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  fileName: string | null;
  error: string | null;
}

// ---------- Repairs ----------
export interface RepairListItem {
  id: string;
  reference: number;
  title: string;
  category: 'HEATING' | 'PLUMBING' | 'ELECTRICAL' | 'DAMP_MOULD' | 'APPLIANCES' | 'SECURITY' | 'OTHER';
  priority: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
  status: 'REPORTED' | 'ACKNOWLEDGED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';
  propertyId: string;
  address: string;
  unitName: string | null;
  tenancyId: string | null;
  contractorName: string | null;
  reportedBy: 'STAFF' | 'TENANT';
  targetAt: string;
  overdue: boolean;
  visitAt: string | null;
  costPence: number | null;
  createdAt: string;
}

export interface RepairEventItem {
  id: string;
  type: 'CREATED' | 'STATUS' | 'COMMENT' | 'ASSIGNED' | 'VISIT' | 'COST' | 'PHOTO';
  visibility: 'TENANT' | 'INTERNAL';
  actorType: 'STAFF' | 'TENANT' | 'CONTRACTOR' | 'SYSTEM';
  actorName: string | null;
  fromStatus: RepairListItem['status'] | null;
  toStatus: RepairListItem['status'] | null;
  body: string | null;
  createdAt: string;
}

export interface RepairPhoto {
  id: string;
  uploadedBy: 'STAFF' | 'TENANT' | 'CONTRACTOR' | 'SYSTEM';
  ready: boolean;
  createdAt: string;
}

export interface RepairDetail extends RepairListItem {
  description: string;
  accessNotes: string | null;
  availability: string | null;
  contractorId: string | null;
  tenants: { name: string; phone: string | null; email: string | null }[];
  events: RepairEventItem[];
  photos: RepairPhoto[];
  link: { active: boolean; expiresAt: string | null; lastUsedAt: string | null } | null;
  completedAt: string | null;
  closedAt: string | null;
}

/** What a contractor sees on their job page. No other repair, tenant or landlord data. */
export interface ContractorJob {
  reference: number;
  workspaceName: string;
  workspaceContact: string | null;
  title: string;
  category: RepairListItem['category'];
  priority: RepairListItem['priority'];
  status: RepairListItem['status'];
  description: string;
  accessNotes: string | null;
  availability: string | null;
  address: string;
  unitName: string | null;
  tenant: { names: string; phone: string | null } | null;
  visitAt: string | null;
  costPence: number | null;
  canUpdate: boolean;
  updates: { body: string | null; toStatus: RepairListItem['status'] | null; type: RepairEventItem['type']; createdAt: string }[];
  photos: { id: string; ready: boolean }[];
}

// ---------- Compliance ----------
export interface ComplianceCell {
  type: 'GAS_SAFETY' | 'EICR' | 'EPC' | 'SMOKE_CO_ALARM' | 'LICENCE' | 'INSURANCE';
  status: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'MISSING' | 'NOT_NEEDED';
  documentId: string | null;
  expiresOn: string | null;
  daysLeft: number | null;
}

export interface ComplianceRow {
  propertyId: string;
  address: string;
  type: string;
  cells: ComplianceCell[];
  worst: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'MISSING';
}

export interface ComplianceBoard {
  types: ComplianceCell['type'][];
  rows: ComplianceRow[];
  counts: { VALID: number; EXPIRING: number; EXPIRED: number; MISSING: number };
}

// ---------- Messages ----------
export interface MessageItem {
  id: string;
  authorType: 'STAFF' | 'TENANT' | 'CONTRACTOR' | 'SYSTEM';
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface ThreadSummary {
  tenancyId: string;
  tenantNames: string;
  address: string;
  lastMessage: { body: string; authorType: MessageItem['authorType']; createdAt: string } | null;
  unread: number;
}

// ---------- Tenant portal ----------
export interface PortalTenancy {
  id: string;
  address: string;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDING' | 'ENDED';
  startDate: string;
  endDate: string | null;
  rentPence: number;
  frequency: 'MONTHLY' | 'WEEKLY' | 'FOUR_WEEKLY';
}

export interface PortalHome {
  workspace: { name: string; contactEmail: string | null; contactPhone: string | null; hasLogo: boolean; id: string };
  tenancy: PortalTenancy | null;
  tenancies: PortalTenancy[];
  balancePence: number;
  arrearsPence: number;
  nextDueDate: string | null;
  nextDuePence: number | null;
  openRepairs: RepairListItem[];
  latestMessages: MessageItem[];
  unreadMessages: number;
}

export interface PortalRepair {
  id: string;
  reference: number;
  title: string;
  category: RepairListItem['category'];
  status: RepairListItem['status'];
  description: string;
  accessNotes: string | null;
  availability: string | null;
  visitAt: string | null;
  createdAt: string;
  events: { type: RepairEventItem['type']; actorType: RepairEventItem['actorType']; actorName: string | null; toStatus: RepairListItem['status'] | null; body: string | null; createdAt: string }[];
  photos: { id: string; ready: boolean }[];
}

export interface PortalDetails {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
}

// ---------- Dashboard, calendar, reports ----------
export interface AttentionItem {
  kind: 'ARREARS' | 'REPAIR_OVERDUE' | 'REPAIR_NEW' | 'CERT_EXPIRED' | 'CERT_EXPIRING' | 'CERT_MISSING' | 'DEPOSIT' | 'RIGHT_TO_RENT' | 'ENDING';
  severity: 'bad' | 'warn';
  title: string;
  detail: string;
  href: string;
}

export interface Dashboard {
  stats: {
    rentDueThisWeekPence: number;
    rentDueThisWeekCount: number;
    overduePence: number;
    overdueCount: number;
    openRepairs: number;
    overdueRepairs: number;
    certificatesExpiring: number;
    certificatesExpired: number;
    certificatesMissing: number;
    endingSoon: number;
    vacantUnits: number;
    totalUnits: number;
  };
  attention: AttentionItem[];
  /** Rent received per month, last 6 months, for the small chart. */
  income: { month: string; pence: number }[];
}

export interface CalendarEvent {
  date: string;
  kind: 'RENT_DUE' | 'REPAIR_VISIT' | 'CERT_EXPIRY' | 'TENANCY_START' | 'TENANCY_END';
  title: string;
  detail: string;
  href: string;
  /** Visits only: the time, as an ISO timestamp. */
  at?: string;
}

export interface RentRollRow {
  tenancyId: string;
  address: string;
  tenantNames: string;
  status: string;
  rentPence: number;
  frequency: string;
  startDate: string;
  endDate: string | null;
  balancePence: number;
}

export interface IncomeReport {
  months: string[];
  rows: { propertyId: string; address: string; byMonth: number[]; totalPence: number }[];
  totals: number[];
  totalPence: number;
}

export interface MaintenanceRow {
  propertyId: string;
  address: string;
  repairs: number;
  costPence: number;
  items: { reference: number; title: string; date: string; costPence: number; contractor: string | null }[];
}
