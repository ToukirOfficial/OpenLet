'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, formatDate, londonDate, type CalendarEvent } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { FilterChips } from '@/components/filter-chips';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

const KINDS: Record<CalendarEvent['kind'], { label: string; dot: string }> = {
  RENT_DUE: { label: 'Rent due', dot: 'bg-chart' },
  REPAIR_VISIT: { label: 'Repair visit', dot: 'bg-info' },
  CERT_EXPIRY: { label: 'Certificate expiry', dot: 'bg-brass' },
  TENANCY_START: { label: 'Tenancy starts', dot: 'bg-slate' },
  TENANCY_END: { label: 'Tenancy ends', dot: 'bg-slate/50' },
};
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The Monday on or before the 1st, through the Sunday on or after the month's last day. */
function monthGrid(month: string) {
  const first = `${month}-01`;
  const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -dow);
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = addDays(next.toISOString().slice(0, 10), -1);
  const trailing = 6 - ((new Date(`${last}T00:00:00Z`).getUTCDay() + 6) % 7);
  const end = addDays(last, trailing);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return { start, end, days };
}

function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

function EventLine({ e, compact }: { e: CalendarEvent; compact?: boolean }) {
  return (
    <Link href={e.href} className={cn('flex items-start gap-1.5 rounded px-1 hover:bg-stone-deep', compact ? 'py-0.5 text-xs' : 'py-1.5 text-sm')} title={`${e.title}: ${e.detail}`}>
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', KINDS[e.kind].dot)} aria-hidden />
      <span className={cn('min-w-0', compact && 'truncate')}>
        <span className="sr-only">{KINDS[e.kind].label}: </span>
        {e.at ? `${TIME.format(new Date(e.at))} ` : ''}
        <span className="font-medium">{e.title}</span>
        {compact ? null : <span className="block text-muted-foreground">{e.detail}</span>}
      </span>
    </Link>
  );
}

export default function CalendarPage() {
  const today = londonDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState<'month' | 'list'>('month');
  const grid = useMemo(() => monthGrid(month), [month]);
  const { data, error, loading, reload } = useApi<CalendarEvent[]>(`/calendar?from=${grid.start}&to=${grid.end}`);
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of data ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [data]);

  return (
    <>
      <PageHeader title="Calendar" description="Rent due dates, repair visits, certificate expiries and tenancy starts and ends." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold">{MONTH.format(new Date(`${month}-01T00:00:00Z`))}</h2>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>
            Today
          </Button>
        </div>
        <FilterChips<'month' | 'list'> label="View" value={view} onChange={(v) => setView(v || 'month')} options={[{ value: 'month', label: 'Month' }, { value: 'list', label: 'List' }]} />
      </div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Key">
        {Object.values(KINDS).map((k) => (
          <li key={k.label} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', k.dot)} aria-hidden /> {k.label}
          </li>
        ))}
      </ul>
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : view === 'list' ? (
        !data!.length ? (
          <EmptyState icon={CalendarDays} title="Nothing this month" />
        ) : (
          <ol className="space-y-4">
            {[...byDay.entries()]
              .filter(([d]) => d.startsWith(month))
              .map(([d, list]) => (
                <li key={d} className="rounded-lg border border-border bg-paper px-4 py-3">
                  <h3 className={cn('mb-1 font-semibold', d === today && 'text-door')}>{d === today ? `Today, ${formatDate(d)}` : formatDate(d)}</h3>
                  {list.map((e, i) => (
                    <EventLine key={i} e={e} />
                  ))}
                </li>
              ))}
          </ol>
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-paper">
          <div className="grid min-w-[46rem] grid-cols-7">
            {WEEKDAYS.map((w) => (
              <div key={w} className="border-b border-border px-2 py-2 text-xs font-semibold text-muted-foreground">
                {w}
              </div>
            ))}
            {grid.days.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.startsWith(month);
              return (
                <div key={d} className={cn('min-h-28 border-r border-b border-border/70 p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-stone/50')}>
                  <p className={cn('mb-1 text-right text-xs', d === today ? 'font-bold text-door' : inMonth ? 'text-slate/80' : 'text-muted-foreground/60')}>
                    {d === today ? <span className="rounded-full bg-door px-1.5 py-0.5 text-white">{Number(d.slice(8))}</span> : Number(d.slice(8))}
                  </p>
                  {list.slice(0, 3).map((e, i) => (
                    <EventLine key={i} e={e} compact />
                  ))}
                  {list.length > 3 ? (
                    <button className="px-1 text-xs font-semibold text-door hover:underline" onClick={() => setView('list')}>
                      {list.length - 3} more
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
