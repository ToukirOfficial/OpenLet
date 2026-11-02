'use client';

import { MessageSquare } from 'lucide-react';
import { RepairsFor } from '@/components/repair-list';
import type { TenancyDetail } from '@openlet/shared';
import { EmptyState } from '@/components/states';

/** Filled in by later phases: repairs (Phase 5) and messages (Phase 7). */
export { TenancyLedger } from './tenancy-ledger';
export function TenancyRepairs({ tenancy }: { tenancy: TenancyDetail }) {
  return <RepairsFor query={`propertyId=${tenancy.propertyId}`} emptyText="Repairs at this property will be listed here." newHref={`/app/repairs/new?propertyId=${tenancy.propertyId}`} />;
}
export function TenancyMessages(_: { tenancy: TenancyDetail }) {
  return <EmptyState icon={MessageSquare} title="No messages yet" />;
}
