'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { formatDateTime, type ThreadSummary } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

export default function MessagesPage() {
  const { data, error, loading, reload } = useApi<ThreadSummary[]>('/messages/threads');
  return (
    <>
      <PageHeader title="Messages" description="Conversations with tenants, one per tenancy. Start one from a tenancy’s Messages tab." />
      {loading && !data ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.length ? (
        <EmptyState icon={MessageSquare} title="No conversations yet">
          Open a tenancy and use its Messages tab to write to the tenants. Their replies arrive here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-paper">
          {data!.map((t) => (
            <li key={t.tenancyId} className="relative flex items-start gap-3 px-4 py-3.5">
              <span className={cn('mt-2 size-2.5 shrink-0 rounded-full', t.unread ? 'bg-door' : 'bg-transparent')} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/app/tenancies/${t.tenancyId}?tab=messages`} className={cn('after:absolute after:inset-0 hover:text-door', t.unread ? 'font-bold' : 'font-semibold')}>
                    {t.tenantNames}
                  </Link>
                  {t.lastMessage ? <span className="text-xs text-muted-foreground">{formatDateTime(t.lastMessage.createdAt)}</span> : null}
                </div>
                <p className="text-sm text-muted-foreground">{t.address}</p>
                {t.lastMessage ? (
                  <p className="mt-1 truncate text-sm">
                    {t.lastMessage.authorType === 'STAFF' ? 'You: ' : ''}
                    {t.lastMessage.body}
                  </p>
                ) : null}
              </div>
              {t.unread ? <span className="rounded-full bg-door px-2 py-0.5 text-xs font-bold text-white">{t.unread} new</span> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
