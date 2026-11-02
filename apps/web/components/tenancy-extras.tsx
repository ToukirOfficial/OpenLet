'use client';

import { MessageSquare, Wrench } from 'lucide-react';
import type { TenancyDetail } from '@openlet/shared';
import { EmptyState } from '@/components/states';

/** Filled in by later phases: repairs (Phase 5) and messages (Phase 7). */
export { TenancyLedger } from './tenancy-ledger';
export function TenancyRepairs(_: { tenancy: TenancyDetail }) {
  return <EmptyState icon={Wrench} title="No repairs yet" />;
}
export function TenancyMessages(_: { tenancy: TenancyDetail }) {
  return <EmptyState icon={MessageSquare} title="No messages yet" />;
}
