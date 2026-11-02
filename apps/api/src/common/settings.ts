import { workspaceSettingsSchema, type WorkspaceSettingsInput } from '@openlet/shared';

export type WorkspaceSettings = Omit<WorkspaceSettingsInput, 'name' | 'contactEmail' | 'contactPhone' | 'address'>;

/** Defaults for a new workspace (ASSUMPTIONS.md). */
export const DEFAULT_SETTINGS: WorkspaceSettings = {
  reminders: {
    rentDueDaysBefore: 3,
    overdueDays: [3, 7, 14],
    certificateDays: [60, 30, 7],
    depositProtectDays: 30,
    rightToRentDaysBefore: 28,
  },
  targetHours: { EMERGENCY: 24, URGENT: 72, ROUTINE: 672 },
  contractorSeesTenantContact: false,
  requiredCertificates: ['GAS_SAFETY', 'EICR', 'EPC', 'SMOKE_CO_ALARM', 'LICENCE'],
  retentionYears: 6,
};

const settingsOnly = workspaceSettingsSchema.omit({ name: true, contactEmail: true, contactPhone: true, address: true });

/** Settings JSON from the database, with defaults for anything missing or invalid. */
export function readSettings(json: unknown): WorkspaceSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(typeof json === 'object' && json ? json : {}) };
  const parsed = settingsOnly.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
