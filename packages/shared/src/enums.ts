/** Values shared by the API, the database (Prisma enums use the same names) and the web app. */
export const WORKSPACE_ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROPERTY_TYPES = ['HOUSE', 'FLAT', 'HMO', 'BUNGALOW', 'OTHER'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const FURNISHED = ['FURNISHED', 'PART_FURNISHED', 'UNFURNISHED'] as const;
export type Furnished = (typeof FURNISHED)[number];
export const PROPERTY_STATUSES = ['OCCUPIED', 'VACANT', 'ENDING_SOON'] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const RENT_FREQUENCIES = ['MONTHLY', 'WEEKLY', 'FOUR_WEEKLY'] as const;
export type RentFrequency = (typeof RENT_FREQUENCIES)[number];
export const TENANCY_STATUSES = ['UPCOMING', 'ACTIVE', 'ENDING', 'ENDED'] as const;
export type TenancyStatus = (typeof TENANCY_STATUSES)[number];

export const LEDGER_TYPES = ['RENT_CHARGE', 'OTHER_CHARGE', 'PAYMENT', 'CREDIT', 'REVERSAL'] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];
export const PAYMENT_METHODS = ['BANK_TRANSFER', 'STANDING_ORDER', 'CASH', 'CARD', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DEPOSIT_SCHEMES = ['DPS', 'TDS', 'MYDEPOSITS', 'OTHER'] as const;
export type DepositScheme = (typeof DEPOSIT_SCHEMES)[number];

export const RTR_METHODS = ['MANUAL_DOCUMENT', 'ONLINE_SHARE_CODE', 'IDVT', 'LANDLORD_CHECKING_SERVICE'] as const;
export type RtrMethod = (typeof RTR_METHODS)[number];

export const REPAIR_CATEGORIES = ['HEATING', 'PLUMBING', 'ELECTRICAL', 'DAMP_MOULD', 'APPLIANCES', 'SECURITY', 'OTHER'] as const;
export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];
export const REPAIR_PRIORITIES = ['EMERGENCY', 'URGENT', 'ROUTINE'] as const;
export type RepairPriority = (typeof REPAIR_PRIORITIES)[number];
export const REPAIR_STATUSES = ['REPORTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];
export const OPEN_REPAIR_STATUSES: readonly RepairStatus[] = ['REPORTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS'];
/** Statuses a contractor may set from the job page. */
export const CONTRACTOR_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] as const;

export const DOCUMENT_TYPES = [
  'TENANCY_AGREEMENT',
  'GAS_SAFETY',
  'EICR',
  'EPC',
  'DEPOSIT_CERTIFICATE',
  'PRESCRIBED_INFORMATION',
  'HOW_TO_RENT',
  'RIGHT_TO_RENT_EVIDENCE',
  'SMOKE_CO_ALARM',
  'LICENCE',
  'INSURANCE',
  'INVENTORY',
  'PHOTO',
  'OTHER',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
/** Property certificates that appear on the compliance board. */
export const CERTIFICATE_TYPES = ['GAS_SAFETY', 'EICR', 'EPC', 'SMOKE_CO_ALARM', 'LICENCE', 'INSURANCE'] as const satisfies readonly DocumentType[];
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];
export const COMPLIANCE_STATUSES = ['VALID', 'EXPIRING', 'EXPIRED', 'MISSING'] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const VISIBILITIES = ['TENANT', 'INTERNAL'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
