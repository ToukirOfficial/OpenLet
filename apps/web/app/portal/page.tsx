'use client';

import Link from 'next/link';
import { ChevronRight, KeyRound, Mail, MessageSquare, Phone, Wrench } from 'lucide-react';
import { FREQUENCY_SHORT, REPAIR_STATUS_LABELS, formatDate, formatDateTime, formatPence, type PortalHome } from '@openlet/shared';
import { EmptyState, ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/session';
import { REPAIR_STATUS_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';

export default function PortalHomePage() {
  const { me } = useSession();
  const { data: h, error, loading, reload } = useApi<PortalHome>('/portal/home');
  if (loading && !h)
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  if (error || !h) return <ErrorState error={error} onRetry={reload} />;
  const t = h.tenancy;
  const owed = h.balancePence > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold">Hello {me.name.split(' ')[0]}</h1>
        {t ? <p className="text-muted-foreground">{t.address}</p> : null}
      </div>

      {!t ? (
        <EmptyState icon={KeyRound} title="No tenancy yet">
          Once {h.workspace.name} sets up your tenancy, your rent, repairs and documents will appear here.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="rent-h" className="overflow-hidden rounded-xl border border-border bg-paper">
            <div className={owed ? 'bg-bad-tint px-5 py-5' : 'bg-door-tint px-5 py-5'}>
              <h2 id="rent-h" className="text-sm font-semibold text-slate/80">
                Your balance
              </h2>
              <p className={`mt-1 text-[2.25rem] leading-none font-bold tabular-nums ${owed ? 'text-bad' : 'text-door'}`}>{formatPence(Math.abs(h.balancePence))}</p>
              <p className="mt-2 font-medium">{owed ? (h.arrearsPence > 0 ? 'Overdue. Please pay as soon as you can.' : 'Due now.') : h.balancePence < 0 ? 'In credit. Thank you!' : 'All paid up. Thank you!'}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm text-muted-foreground">Next rent</p>
                <p className="font-semibold">{h.nextDueDate ? `${formatPence(h.nextDuePence)} on ${formatDate(h.nextDueDate)}` : 'No more rent due'}</p>
                <p className="text-sm text-muted-foreground">
                  Rent is {formatPence(t.rentPence)} {FREQUENCY_SHORT[t.frequency]}
                </p>
              </div>
              <Button asChild variant="outline" size="lg">
                <Link href="/portal/rent">
                  Rent history <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </section>

          <Button asChild size="lg" className="h-16 w-full text-base">
            <Link href="/portal/repairs/new">
              <Wrench className="size-5" /> Report a repair
            </Link>
          </Button>

          <section aria-labelledby="repairs-h" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 id="repairs-h" className="font-semibold">
                Open repairs
              </h2>
              <Link href="/portal/repairs" className="text-sm font-semibold text-door hover:underline">
                See all
              </Link>
            </div>
            {!h.openRepairs.length ? (
              <p className="rounded-lg border border-border bg-paper px-4 py-3 text-sm text-muted-foreground">Nothing open. If something breaks, report it above.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-paper">
                {h.openRepairs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/portal/repairs/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{r.title}</p>
                        <p className="text-sm text-muted-foreground">{r.visitAt && r.status === 'SCHEDULED' ? `Visit ${formatDateTime(r.visitAt)}` : `Reported ${formatDate(r.createdAt.slice(0, 10))}`}</p>
                      </div>
                      <StatusBadge tone={REPAIR_STATUS_TONE[r.status]}>{REPAIR_STATUS_LABELS[r.status]}</StatusBadge>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="msg-h" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 id="msg-h" className="font-semibold">
                Messages {h.unreadMessages ? <span className="ml-1 rounded-full bg-door px-2 py-0.5 text-xs text-white">{h.unreadMessages} new</span> : null}
              </h2>
              <Link href="/portal/messages" className="text-sm font-semibold text-door hover:underline">
                Open
              </Link>
            </div>
            {!h.latestMessages.length ? (
              <Link href="/portal/messages" className="flex items-center gap-3 rounded-lg border border-border bg-paper px-4 py-3 text-sm hover:bg-stone">
                <MessageSquare className="size-4 text-door" aria-hidden /> Send a message to {h.workspace.name}
              </Link>
            ) : (
              <ul className="space-y-2">
                {h.latestMessages.slice(-2).map((m) => (
                  <li key={m.id} className="rounded-lg border border-border bg-paper px-4 py-3">
                    <p className="line-clamp-2">{m.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.mine ? 'You' : m.authorName} · {formatDateTime(m.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="rounded-lg border border-border bg-paper px-4 py-4">
        <h2 className="font-semibold">Contact {h.workspace.name}</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {h.workspace.contactPhone ? (
            <Button asChild variant="outline" size="lg">
              <a href={`tel:${h.workspace.contactPhone}`}>
                <Phone className="size-4" /> {h.workspace.contactPhone}
              </a>
            </Button>
          ) : null}
          {h.workspace.contactEmail ? (
            <Button asChild variant="outline" size="lg">
              <a href={`mailto:${h.workspace.contactEmail}`}>
                <Mail className="size-4" /> Email
              </a>
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">For an emergency like a gas leak, call the National Gas Emergency line on 0800 111 999 first.</p>
      </section>
    </div>
  );
}
