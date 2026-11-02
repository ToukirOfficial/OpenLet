import { daysBetween, londonDate, type IsoDate } from './dates.js';
import type { CertificateType, ComplianceStatus, PropertyType } from './enums.js';

/** "Expiring" from this many days before the expiry date (PRD: 60 days or less). */
export const EXPIRING_DAYS = 60;

/**
 * Compliance status of one certificate type on one property. Valid: more than 60 days left. Expiring:
 * 60 days or less. Expired: past its expiry date (London day). Missing: required and not uploaded.
 * A certificate without an expiry date counts as valid.
 */
export function certificateStatus(expiresOn: IsoDate | null | undefined, present: boolean, today: IsoDate = londonDate()): ComplianceStatus {
  if (!present) return 'MISSING';
  if (!expiresOn) return 'VALID';
  if (expiresOn < today) return 'EXPIRED';
  return daysBetween(today, expiresOn) <= EXPIRING_DAYS ? 'EXPIRING' : 'VALID';
}

/** Whether a certificate type is needed for a property, from the workspace's required list. */
export function isRequired(type: CertificateType, required: readonly CertificateType[], property: { type: PropertyType; hasGas: boolean }): boolean {
  if (!required.includes(type)) return false;
  if (type === 'GAS_SAFETY') return property.hasGas;
  if (type === 'LICENCE') return property.type === 'HMO';
  return true;
}

const RANK: Record<ComplianceStatus, number> = { VALID: 0, EXPIRING: 1, MISSING: 2, EXPIRED: 3 };
export const worstStatus = (list: ComplianceStatus[]): ComplianceStatus => list.reduce<ComplianceStatus>((w, s) => (RANK[s] > RANK[w] ? s : w), 'VALID');
