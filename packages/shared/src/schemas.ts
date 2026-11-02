import { z } from 'zod';
import {
  CONTRACTOR_STATUSES,
  DEPOSIT_SCHEMES,
  DOCUMENT_TYPES,
  FURNISHED,
  PAYMENT_METHODS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  RENT_FREQUENCIES,
  REPAIR_CATEGORIES,
  REPAIR_PRIORITIES,
  REPAIR_STATUSES,
  RTR_METHODS,
  TENANCY_STATUSES,
  VISIBILITIES,
  WORKSPACE_ROLES,
  CERTIFICATE_TYPES,
} from './enums.js';

/**
 * Every request body, query and route parameter is parsed with one of these. z.object strips unknown
 * fields, so nothing the client adds ever reaches the database.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number, label = 'This') => z.string().trim().min(1, `${label} is required`).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const email = z.string().trim().toLowerCase().max(254).email('Enter a valid email address');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date');
export const optionalDate = isoDate
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));
export const pence = z.number().int('Amounts are in whole pence').min(0).max(100_000_000);
export const positivePence = pence.min(1, 'Enter an amount above £0');
export const id = z.uuid('Not a valid id');
export const idParam = z.object({ id });
export const tokenParam = z.object({ token: z.string().min(20).max(200) });

/** UK postcode, normalised to upper case with one space ("LS1 4AP"). */
export const postcode = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => /^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(v), 'Enter a valid UK postcode')
  .transform((v) => `${v.slice(0, -3)} ${v.slice(-3)}`);
export const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d][\d\s()-]{5,}$/, 'Enter a valid phone number')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

export const password = z.string().min(10, 'Use at least 10 characters').max(200);

// ---------- Auth and setup ----------
export const setupSchema = z.object({
  name: required(100, 'Your name'),
  email,
  password,
  workspaceName: required(120, 'Business name'),
});
export const signupSchema = setupSchema;
export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export const verifyCodeSchema = z.object({
  challenge: z.string().min(20).max(400),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export const resendCodeSchema = z.object({ challenge: z.string().min(20).max(400) });
export const resetRequestSchema = z.object({ email });
export const resetConfirmSchema = z.object({ token: z.string().min(20).max(200), password });
export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  name: required(100, 'Your name').optional(),
  password: password.optional(),
});
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), password });

// ---------- Workspaces and team ----------
export const createWorkspaceSchema = z.object({ name: required(120, 'Workspace name') });
export const inviteMemberSchema = z.object({ email, role: z.enum(WORKSPACE_ROLES) });
export const updateMemberSchema = z.object({ role: z.enum(WORKSPACE_ROLES) });
export const deleteWorkspaceSchema = z.object({ confirmName: z.string().trim().min(1).max(120) });

export const reminderSettingsSchema = z.object({
  rentDueDaysBefore: z.number().int().min(0).max(14),
  overdueDays: z.array(z.number().int().min(1).max(90)).max(5),
  certificateDays: z.array(z.number().int().min(1).max(180)).max(5),
  depositProtectDays: z.number().int().min(1).max(60),
  rightToRentDaysBefore: z.number().int().min(1).max(90),
});
export const workspaceSettingsSchema = z.object({
  name: required(120, 'Workspace name'),
  contactEmail: email.optional().nullable().or(z.literal('')).transform((v) => v || null),
  contactPhone: phone,
  address: optionalText(300),
  reminders: reminderSettingsSchema,
  targetHours: z.object({
    EMERGENCY: z.number().int().min(1).max(720),
    URGENT: z.number().int().min(1).max(2160),
    ROUTINE: z.number().int().min(1).max(8760),
  }),
  contractorSeesTenantContact: z.boolean(),
  requiredCertificates: z.array(z.enum(CERTIFICATE_TYPES)).max(CERTIFICATE_TYPES.length),
  retentionYears: z.number().int().min(1).max(10),
});
export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;

// ---------- Properties ----------
export const propertySchema = z.object({
  addressLine1: required(120, 'Address line 1'),
  addressLine2: optionalText(120),
  town: required(80, 'Town or city'),
  county: optionalText(80),
  postcode,
  type: z.enum(PROPERTY_TYPES),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(30),
  furnished: z.enum(FURNISHED),
  hasGas: z.boolean(),
  notes: optionalText(4000),
  units: z.array(required(80, 'Unit name')).max(100).optional(),
});
export const propertyUpdateSchema = propertySchema.omit({ units: true });
export const unitSchema = z.object({ name: required(80, 'Unit name') });
export const listQuery = z.object({
  q: trimmed(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export const propertyListQuery = listQuery.extend({ status: z.enum(PROPERTY_STATUSES).optional() });

// ---------- Tenants ----------
export const tenantSchema = z.object({
  firstName: required(80, 'First name'),
  lastName: required(80, 'Last name'),
  email: email.optional().nullable().or(z.literal('')).transform((v) => v || null),
  phone,
  dateOfBirth: optionalDate,
  emergencyName: optionalText(120),
  emergencyPhone: phone,
  notes: optionalText(4000),
});
export const rightToRentSchema = z.object({
  checkedOn: isoDate,
  method: z.enum(RTR_METHODS),
  expiresOn: optionalDate,
  notes: optionalText(1000),
});
export const tenantListQuery = listQuery;

// ---------- Contractors ----------
export const contractorSchema = z.object({
  name: required(120, 'Name'),
  company: optionalText(120),
  trade: required(80, 'Trade'),
  email,
  phone,
  notes: optionalText(2000),
});

// ---------- Tenancies ----------
export const tenancySchema = z
  .object({
    unitId: id,
    tenantIds: z.array(id).min(1, 'Choose at least one tenant').max(10),
    startDate: isoDate,
    endDate: optionalDate,
    rentPence: positivePence,
    frequency: z.enum(RENT_FREQUENCIES),
    dueDay: z.number().int().min(1).max(31),
    remindersEnabled: z.boolean().default(true),
    deposit: z
      .object({
        amountPence: positivePence,
        receivedOn: optionalDate,
      })
      .optional()
      .nullable(),
  })
  .refine((t) => !t.endDate || t.endDate > t.startDate, { path: ['endDate'], message: 'End date must be after the start' });
export const tenancyUpdateSchema = z.object({
  /** Leave out to keep the end date; null makes the tenancy rolling. */
  endDate: isoDate.nullable().optional(),
  remindersEnabled: z.boolean().optional(),
});
export const tenancyListQuery = listQuery.extend({ status: z.enum(TENANCY_STATUSES).optional() });
export const rentChangeSchema = z.object({ amountPence: positivePence, effectiveFrom: isoDate });
export const noticeSchema = z.object({
  givenBy: z.enum(['TENANT', 'LANDLORD']),
  givenOn: isoDate,
  endDate: isoDate,
});
export const endTenancySchema = z.object({ endedOn: isoDate });
export const guarantorSchema = z.object({
  name: required(120, 'Name'),
  email: email.optional().nullable().or(z.literal('')).transform((v) => v || null),
  phone,
  address: optionalText(300),
  notes: optionalText(2000),
});
export const depositSchema = z.object({
  amountPence: positivePence,
  receivedOn: optionalDate,
  scheme: z.enum(DEPOSIT_SCHEMES).optional().nullable(),
  schemeReference: optionalText(80),
  protectedOn: optionalDate,
  prescribedInfoOn: optionalDate,
});
export const depositReturnSchema = z.object({
  returnedOn: isoDate,
  deductions: z
    .array(z.object({ reason: required(200, 'Reason'), amountPence: positivePence }))
    .max(30),
});

// ---------- Ledger ----------
export const paymentSchema = z.object({
  tenancyId: id,
  date: isoDate,
  amountPence: positivePence,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
});
export const otherChargeSchema = z.object({
  tenancyId: id,
  date: isoDate,
  amountPence: positivePence,
  description: required(200, 'Description'),
});
export const reverseEntrySchema = z.object({ reason: required(200, 'Reason') });
export const statementSchema = z.object({ from: isoDate, to: isoDate }).refine((s) => s.to >= s.from, {
  path: ['to'],
  message: 'The end date must be on or after the start',
});

// ---------- Repairs ----------
export const reportRepairSchema = z.object({
  category: z.enum(REPAIR_CATEGORIES),
  title: required(120, 'A short title'),
  description: required(4000, 'Description'),
  accessNotes: optionalText(1000),
  availability: optionalText(500),
});
export const staffRepairSchema = reportRepairSchema.extend({
  propertyId: id,
  unitId: id.optional().nullable(),
  tenancyId: id.optional().nullable(),
  priority: z.enum(REPAIR_PRIORITIES),
});
export const repairUpdateSchema = z.object({
  priority: z.enum(REPAIR_PRIORITIES).optional(),
  title: required(120, 'Title').optional(),
  description: required(4000, 'Description').optional(),
  accessNotes: optionalText(1000),
  costPence: pence.optional().nullable(),
});
export const repairStatusSchema = z.object({ status: z.enum(REPAIR_STATUSES), note: optionalText(2000) });
export const repairCommentSchema = z.object({ body: required(4000, 'Comment'), visibility: z.enum(VISIBILITIES) });
export const assignContractorSchema = z.object({ contractorId: id });
export const repairListQuery = listQuery.extend({
  status: z.enum(['OPEN', ...REPAIR_STATUSES]).optional(),
  propertyId: id.optional(),
});
export const contractorUpdateSchema = z.object({
  status: z.enum(CONTRACTOR_STATUSES).optional(),
  visitAt: z.iso.datetime({ offset: true }).optional().nullable(),
  note: optionalText(2000),
  costPence: pence.optional().nullable(),
});

// ---------- Documents ----------
export const documentUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  title: optionalText(160),
  propertyId: id.optional(),
  tenancyId: id.optional(),
  tenantId: id.optional(),
  repairId: id.optional(),
  expiresOn: optionalDate,
  issuedOn: optionalDate,
  sharedWithTenant: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});
export const documentUpdateSchema = z.object({
  title: optionalText(160),
  type: z.enum(DOCUMENT_TYPES).optional(),
  expiresOn: optionalDate,
  issuedOn: optionalDate,
  sharedWithTenant: z.boolean().optional(),
});
export const documentListQuery = z.object({
  propertyId: id.optional(),
  tenancyId: id.optional(),
  tenantId: id.optional(),
  repairId: id.optional(),
});

// ---------- Messages, notes ----------
export const messageSchema = z.object({ body: required(4000, 'Message') });
export const noteSchema = z.object({
  body: required(4000, 'Note'),
  propertyId: id.optional(),
  tenancyId: id.optional(),
  tenantId: id.optional(),
});
export const notesQuery = z.object({ propertyId: id.optional(), tenancyId: id.optional(), tenantId: id.optional() });
export const activityQuery = z.object({
  propertyId: id.optional(),
  tenancyId: id.optional(),
  tenantId: id.optional(),
  repairId: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// ---------- Portal ----------
export const portalContactSchema = z.object({ phone, emergencyName: optionalText(120), emergencyPhone: phone });

// ---------- Reports, calendar ----------
export const rangeQuery = z.object({ from: isoDate, to: isoDate, format: z.enum(['json', 'csv']).default('json') });
export const formatQuery = z.object({ format: z.enum(['json', 'csv']).default('json') });
export const calendarQuery = z.object({ from: isoDate, to: isoDate });
