import type {
  DepositScheme,
  DocumentType,
  Furnished,
  PaymentMethod,
  PropertyType,
  RentFrequency,
  RepairCategory,
  RepairPriority,
  RepairStatus,
  RtrMethod,
  TenancyStatus,
  WorkspaceRole,
  ComplianceStatus,
  PropertyStatus,
} from './enums.js';

/** Plain UK English labels, used on screens, in emails and in PDFs. */
export const ROLE_LABELS: Record<WorkspaceRole, string> = { OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff' };
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: 'House',
  FLAT: 'Flat',
  HMO: 'HMO',
  BUNGALOW: 'Bungalow',
  OTHER: 'Other',
};
export const FURNISHED_LABELS: Record<Furnished, string> = {
  FURNISHED: 'Furnished',
  PART_FURNISHED: 'Part furnished',
  UNFURNISHED: 'Unfurnished',
};
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  OCCUPIED: 'Occupied',
  VACANT: 'Vacant',
  ENDING_SOON: 'Ending soon',
};
export const FREQUENCY_LABELS: Record<RentFrequency, string> = {
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
  FOUR_WEEKLY: 'Every four weeks',
};
export const FREQUENCY_SHORT: Record<RentFrequency, string> = { MONTHLY: 'pcm', WEEKLY: 'pw', FOUR_WEEKLY: 'per 4 weeks' };
export const TENANCY_STATUS_LABELS: Record<TenancyStatus, string> = {
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  ENDING: 'Ending',
  ENDED: 'Ended',
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  STANDING_ORDER: 'Standing order',
  CASH: 'Cash',
  CARD: 'Card',
  OTHER: 'Other',
};
export const DEPOSIT_SCHEME_LABELS: Record<DepositScheme, string> = {
  DPS: 'Deposit Protection Service (DPS)',
  TDS: 'Tenancy Deposit Scheme (TDS)',
  MYDEPOSITS: 'mydeposits',
  OTHER: 'Other',
};
export const RTR_METHOD_LABELS: Record<RtrMethod, string> = {
  MANUAL_DOCUMENT: 'Manual document check',
  ONLINE_SHARE_CODE: 'Home Office online check (share code)',
  IDVT: 'Identity service provider (IDVT)',
  LANDLORD_CHECKING_SERVICE: 'Landlord Checking Service',
};
export const REPAIR_CATEGORY_LABELS: Record<RepairCategory, string> = {
  HEATING: 'Heating and hot water',
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  DAMP_MOULD: 'Damp and mould',
  APPLIANCES: 'Appliances',
  SECURITY: 'Doors, windows and security',
  OTHER: 'Something else',
};
export const REPAIR_PRIORITY_LABELS: Record<RepairPriority, string> = {
  EMERGENCY: 'Emergency',
  URGENT: 'Urgent',
  ROUTINE: 'Routine',
};
export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  REPORTED: 'Reported',
  ACKNOWLEDGED: 'Acknowledged',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  TENANCY_AGREEMENT: 'Tenancy agreement',
  GAS_SAFETY: 'Gas safety certificate',
  EICR: 'Electrical safety (EICR)',
  EPC: 'Energy Performance Certificate (EPC)',
  DEPOSIT_CERTIFICATE: 'Deposit certificate',
  PRESCRIBED_INFORMATION: 'Prescribed information',
  HOW_TO_RENT: 'How to Rent guide',
  RIGHT_TO_RENT_EVIDENCE: 'Right to Rent evidence',
  SMOKE_CO_ALARM: 'Smoke and CO alarm check',
  LICENCE: 'Licence (HMO or selective)',
  INSURANCE: 'Insurance',
  INVENTORY: 'Inventory',
  PHOTO: 'Photo',
  OTHER: 'Other',
};
export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  VALID: 'Valid',
  EXPIRING: 'Expiring soon',
  EXPIRED: 'Expired',
  MISSING: 'Missing',
};

export const LEGAL_NOTE =
  'Reminders are a helpful aid, not legal advice. Landlords remain responsible for meeting their legal duties.';
