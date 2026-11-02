'use client';

import { MessageSquare, PoundSterling, Wrench } from 'lucide-react';
import type { TenancyDetail } from '@openlet/shared';
import { EmptyState } from '@/components/states';

/** Filled in by later phases: the rent ledger (Phase 4), repairs (Phase 5) and messages (Phase 7). */
export function TenancyLedger(_: { tenancy: TenancyDetail; onChange: () => void }) {
  return <EmptyState icon={PoundSterling} title="Rent ledger">Rent charges and payments will appear here.</EmptyState>;
}
export function TenancyRepairs(_: { tenancy: TenancyDetail }) {
  return <EmptyState icon={Wrench} title="No repairs yet" />;
}
export function TenancyMessages(_: { tenancy: TenancyDetail }) {
  return <EmptyState icon={MessageSquare} title="No messages yet" />;
}
