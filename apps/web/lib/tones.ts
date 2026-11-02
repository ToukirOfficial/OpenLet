import type { ComplianceStatus, PropertyStatus, RepairPriority, RepairStatus, TenancyStatus } from '@openlet/shared';
import type { Tone } from '@/components/status-badge';

export const PROPERTY_TONE: Record<PropertyStatus, Tone> = { OCCUPIED: 'ok', VACANT: 'none', ENDING_SOON: 'warn' };
export const TENANCY_TONE: Record<TenancyStatus, Tone> = { UPCOMING: 'info', ACTIVE: 'ok', ENDING: 'warn', ENDED: 'neutral' };
export const COMPLIANCE_TONE: Record<ComplianceStatus, Tone> = { VALID: 'ok', EXPIRING: 'warn', EXPIRED: 'bad', MISSING: 'none' };
export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  REPORTED: 'bad',
  ACKNOWLEDGED: 'warn',
  SCHEDULED: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'ok',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};
export const PRIORITY_TONE: Record<RepairPriority, Tone> = { EMERGENCY: 'bad', URGENT: 'warn', ROUTINE: 'neutral' };

export const PORTAL_LABEL = { NONE: ['Not invited', 'neutral'], INVITED: ['Invited', 'info'], ACTIVE: ['Using the portal', 'ok'] } as const;
