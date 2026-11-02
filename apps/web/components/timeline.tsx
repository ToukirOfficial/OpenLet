'use client';

import { History } from 'lucide-react';
import { formatDateTime, type ActivityItem } from '@openlet/shared';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { useApi } from '@/lib/use-api';

type Owner = { propertyId?: string; tenancyId?: string; tenantId?: string; repairId?: string };

const WHO: Record<ActivityItem['actorType'], string> = { STAFF: '', TENANT: 'Tenant', CONTRACTOR: 'Contractor', SYSTEM: 'OpenLet' };

/** Who did what and when, newest first. */
export function Timeline({ owner, title = 'Timeline', limit = 50 }: { owner: Owner; title?: string; limit?: number }) {
  const query = new URLSearchParams({ ...(Object.fromEntries(Object.entries(owner).filter(([, v]) => v)) as Record<string, string>), limit: String(limit) }).toString();
  const { data, error, loading, reload } = useApi<ActivityItem[]>(`/activity?${query}`);
  return (
    <Section title={title}>
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.length ? (
        <EmptyState icon={History} title="Nothing has happened yet">
          Changes to this record will be listed here.
        </EmptyState>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {data!.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-paper bg-door" aria-hidden />
              <p>
                <span className="font-semibold">{a.actorName}</span>
                {WHO[a.actorType] ? <span className="text-muted-foreground"> ({WHO[a.actorType]})</span> : null} <span>{a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}</span>
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
