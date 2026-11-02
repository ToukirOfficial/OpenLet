'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { formatDateTime } from '@openlet/shared';
import { Logo } from '@/components/brand';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

interface Mail {
  id: string;
  to: string;
  subject: string;
  html: string;
  createdAt: string;
}

/** Demo only: every email OpenLet would have sent. Nothing leaves the demo server. */
export default function DemoMailPage() {
  const { data, error, loading, reload } = useApi<Mail[]>('/demo/mail');
  const [open, setOpen] = useState<string | null>(null);
  const current = data?.find((m) => m.id === open) ?? data?.[0];
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/demo" aria-label="Back to the demo">
          <Logo />
        </Link>
        <Button variant="outline" onClick={() => void reload()}>
          Refresh
        </Button>
      </div>
      <div>
        <h1 className="text-title font-bold">Demo mail</h1>
        <p className="text-muted-foreground">Rent reminders, repair updates, job links and invites the demo would have emailed. None of them were actually sent.</p>
      </div>
      {loading && !data ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.length ? (
        <EmptyState icon={Inbox} title="No emails yet">
          Record notice, report a repair or assign a contractor in the demo, then come back.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <ul className="max-h-[75dvh] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-paper">
            {data!.map((m) => (
              <li key={m.id}>
                <button onClick={() => setOpen(m.id)} className={cn('w-full px-4 py-3 text-left hover:bg-stone', current?.id === m.id && 'bg-door-tint')}>
                  <span className="block truncate font-semibold">{m.subject}</span>
                  <span className="block truncate text-sm text-muted-foreground">To {m.to}</span>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          {current ? <iframe title={current.subject} sandbox="" srcDoc={current.html} className="h-[75dvh] w-full rounded-lg border border-border bg-white" /> : null}
        </div>
      )}
    </main>
  );
}
