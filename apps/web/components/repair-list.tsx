'use client';

import Link from 'next/link';
import { AlarmClock, Wrench } from 'lucide-react';
import { REPAIR_CATEGORY_LABELS, REPAIR_PRIORITY_LABELS, REPAIR_STATUS_LABELS, formatDateTime, type RepairListItem } from '@openlet/shared';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { PRIORITY_TONE, REPAIR_STATUS_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';

export function RepairRows({ items, hrefBase = '/app/repairs', showAddress = true }: { items: RepairListItem[]; hrefBase?: string; showAddress?: boolean }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-paper">
      {items.map((r) => (
        <li key={r.id} className="relative flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <Link href={`${hrefBase}/${r.id}`} className="font-semibold after:absolute after:inset-0 hover:text-door">
              <span className="text-muted-foreground">#{r.reference}</span> {r.title}
            </Link>
            <p className="truncate text-sm text-muted-foreground">
              {REPAIR_CATEGORY_LABELS[r.category]}
              {showAddress ? ` · ${r.unitName ? `${r.unitName}, ` : ''}${r.address}` : ''}
              {r.contractorName ? ` · ${r.contractorName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {r.overdue ? (
              <StatusBadge tone="bad">
                <AlarmClock className="size-3" aria-hidden /> Past target
              </StatusBadge>
            ) : null}
            <StatusBadge tone={PRIORITY_TONE[r.priority]}>{REPAIR_PRIORITY_LABELS[r.priority]}</StatusBadge>
            <StatusBadge tone={REPAIR_STATUS_TONE[r.status]}>{REPAIR_STATUS_LABELS[r.status]}</StatusBadge>
            {r.visitAt && ['SCHEDULED', 'IN_PROGRESS'].includes(r.status) ? <span className="text-xs text-muted-foreground">Visit {formatDateTime(r.visitAt)}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Repairs for one property or tenancy (tabs on their pages). */
export function RepairsFor({ query, emptyText, newHref }: { query: string; emptyText: string; newHref?: string }) {
  const { data, error, loading, reload } = useApi<{ items: RepairListItem[] }>(`/repairs?${query}`);
  if (loading && !data) return <ListSkeleton rows={3} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data.items.length)
    return (
      <EmptyState icon={Wrench} title="No repairs" action={newHref ? <Link href={newHref} className="text-sm font-semibold text-door hover:underline">Log a repair</Link> : undefined}>
        {emptyText}
      </EmptyState>
    );
  return <RepairRows items={data.items} showAddress={false} />;
}
