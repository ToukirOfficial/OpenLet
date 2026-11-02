'use client';

import Link from 'next/link';
import { ChevronRight, Wrench } from 'lucide-react';
import { REPAIR_STATUS_LABELS, formatDate, type RepairListItem } from '@openlet/shared';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { REPAIR_STATUS_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';

export default function PortalRepairsPage() {
  const { data, error, loading, reload } = useApi<RepairListItem[]>('/portal/repairs');
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-title font-bold">Repairs</h1>
        <Button asChild size="lg">
          <Link href="/portal/repairs/new">
            <Wrench className="size-4" /> Report a repair
          </Link>
        </Button>
      </div>
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.length ? (
        <EmptyState icon={Wrench} title="No repairs reported">
          If something in your home needs fixing, report it with a photo and follow its progress here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-paper">
          {data!.map((r) => (
            <li key={r.id}>
              <Link href={`/portal/repairs/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    #{r.reference} · reported {formatDate(r.createdAt.slice(0, 10))}
                  </p>
                </div>
                <StatusBadge tone={REPAIR_STATUS_TONE[r.status]}>{REPAIR_STATUS_LABELS[r.status]}</StatusBadge>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
