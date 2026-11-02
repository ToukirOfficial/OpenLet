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
