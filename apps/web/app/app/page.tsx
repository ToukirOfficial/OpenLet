'use client';

import Link from 'next/link';
import { AlertTriangle, Building2, CalendarDays, ChevronRight, CircleAlert, KeyRound, UserPlus, Users } from 'lucide-react';
import { formatDate, formatDateTime, formatPence, type ActivityItem, type CalendarEvent, type Dashboard } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { IncomeChart } from '@/components/income-chart';
import { LegalNote } from '@/components/legal-note';
import { Section } from '@/components/section';
import { CardsSkeleton, EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { addDays, londonDate } from '@openlet/shared';

function Stat({ label, value, detail, href, tone }: { label: string; value: string; detail?: string; href: string; tone?: 'bad' | 'warn' }) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col rounded-lg border border-border bg-paper px-4 py-3.5 transition-colors hover:border-line-strong',
        tone === 'bad' && 'border-l-4 border-l-bad',
        tone === 'warn' && 'border-l-4 border-l-warn',
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="mt-1 text-2xl font-bold tabular-nums">{value}</span>
      {detail ? <span className="mt-0.5 text-sm text-muted-foreground">{detail}</span> : null}
    </Link>
  );
}

const STEPS = [
  { href: '/app/properties/new', icon: Building2, title: 'Add a property', text: 'Address, type and rooms. Flats or HMO rooms become units.' },
  { href: '/app/tenants/new', icon: Users, title: 'Add a tenant', text: 'Name and contact details, plus their Right to Rent check.' },
  { href: '/app/tenancies/new', icon: KeyRound, title: 'Create a tenancy', text: 'Rent, dates and deposit. Rent charges then appear by themselves.' },
  { href: '/app/settings/team', icon: UserPlus, title: 'Invite your team', text: 'Managers and staff each get their own login.' },
];

function Upcoming() {
  const today = londonDate();
  const { data } = useApi<CalendarEvent[]>(`/calendar?from=${today}&to=${addDays(today, 7)}`);
  if (!data) return <ListSkeleton rows={3} />;
  const list = data.filter((e) => e.kind !== 'RENT_DUE').slice(0, 6);
  const rent = data.filter((e) => e.kind === 'RENT_DUE').length;
  return (
    <ul className="space-y-2 text-sm">
      {rent ? (
        <li className="flex justify-between gap-2">
          <span>Rent due from {rent} {rent === 1 ? 'tenancy' : 'tenancies'}</span>
          <Link href="/app/calendar" className="text-door hover:underline">
            See all
          </Link>
        </li>
      ) : null}
      {list.map((e, i) => (
        <li key={i}>
          <Link href={e.href} className="block rounded-md px-2 py-1.5 -mx-2 hover:bg-stone">
            <span className="font-medium">{e.title}</span>
            <span className="block text-muted-foreground">
              {e.at ? formatDateTime(e.at) : formatDate(e.date)} · {e.detail}
            </span>
          </Link>
        </li>
      ))}
      {!rent && !list.length ? <li className="text-muted-foreground">Nothing in the next seven days.</li> : null}
    </ul>
  );
}

function Feed() {
  const { data } = useApi<ActivityItem[]>('/activity?limit=8');
  if (!data) return <ListSkeleton rows={4} />;
  if (!data.length) return <p className="text-sm text-muted-foreground">Activity from your team, tenants and contractors will show here.</p>;
  return (
    <ul className="space-y-3 text-sm">
      {data.map((a) => (
        <li key={a.id}>
          <span className="font-semibold">{a.actorName}</span> {a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}
          <span className="block text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { me, workspace } = useSession();
  const { data: d, error, loading, reload } = useApi<Dashboard>('/dashboard');
  const firstName = me.name.split(' ')[0];

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !d) {
    return (
      <>
        <PageHeader title={`Hello, ${firstName}`} />
        <CardsSkeleton count={6} />
      </>
    );
  }
  const s = d!.stats;
  const empty = s.totalUnits === 0;

  return (
    <>
      <PageHeader title={`Hello, ${firstName}`} description={`${workspace?.name}, today ${formatDate(londonDate())}.`} />
      {empty ? (
        <Section title="Get started" description="Four steps to your first rent month.">
          <ol className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((st, i) => (
              <li key={st.href}>
                <Link href={st.href} className="flex h-full gap-4 rounded-lg border border-border p-4 transition-colors hover:border-door/40 hover:bg-door-tint/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-door-tint font-bold text-door">{i + 1}</span>
                  <span>
                    <span className="flex items-center gap-2 font-semibold">
                      <st.icon className="size-4 text-door" aria-hidden /> {st.title}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{st.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="Rent due this week" value={formatPence(s.rentDueThisWeekPence)} detail={`${s.rentDueThisWeekCount} ${s.rentDueThisWeekCount === 1 ? 'payment' : 'payments'}`} href="/app/calendar" />
            <Stat label="Overdue rent" value={formatPence(s.overduePence)} detail={`${s.overdueCount} ${s.overdueCount === 1 ? 'tenancy' : 'tenancies'}`} href="/app/rent" tone={s.overdueCount ? 'bad' : undefined} />
            <Stat label="Open repairs" value={String(s.openRepairs)} detail={s.overdueRepairs ? `${s.overdueRepairs} past target` : 'All on time'} href="/app/repairs" tone={s.overdueRepairs ? 'bad' : undefined} />
            <Stat
              label="Certificates"
              value={String(s.certificatesExpired + s.certificatesExpiring + s.certificatesMissing)}
              detail={`${s.certificatesExpired} expired, ${s.certificatesExpiring} expiring, ${s.certificatesMissing} missing`}
              href="/app/compliance"
              tone={s.certificatesExpired ? 'bad' : s.certificatesExpiring + s.certificatesMissing ? 'warn' : undefined}
            />
            <Stat label="Ending in 60 days" value={String(s.endingSoon)} detail="tenancies" href="/app/tenancies?status=ENDING" tone={s.endingSoon ? 'warn' : undefined} />
            <Stat label="Vacant units" value={String(s.vacantUnits)} detail={`of ${s.totalUnits}`} href="/app/properties?status=VACANT" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-6">
              <Section title="Needs attention" description="The most urgent things first." flush>
                {!d!.attention.length ? (
                  <div className="p-5">
                    <EmptyState icon={CircleAlert} title="Nothing urgent">
                      No arrears, overdue repairs or certificate problems right now.
                    </EmptyState>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {d!.attention.map((a, i) => (
                      <li key={i}>
                        <Link href={a.href} className="flex items-center gap-3 px-5 py-3 hover:bg-stone/70">
                          <AlertTriangle className={cn('size-4 shrink-0', a.severity === 'bad' ? 'text-bad' : 'text-warn')} aria-label={a.severity === 'bad' ? 'Urgent' : 'Soon'} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{a.title}</span>
                            <span className="block truncate text-sm text-muted-foreground">{a.detail}</span>
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section title="Rent received" description="Payments recorded in the last six months.">
                <IncomeChart data={d!.income} />
              </Section>
            </div>
            <div className="space-y-6">
              <Section title="Next seven days" actions={<Link href="/app/calendar" aria-label="Open calendar"><CalendarDays className="size-4 text-muted-foreground" /></Link>}>
                <Upcoming />
              </Section>
              <Section title="Recent activity">
                <Feed />
              </Section>
            </div>
          </div>
          <LegalNote />
        </div>
      )}
    </>
  );
}
