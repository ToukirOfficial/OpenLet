'use client';

import { useState } from 'react';
import { AlarmClock, Camera, Check, FileText, KeyRound, Mail, PoundSterling, ShieldCheck, Wrench } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';

/** The five core journeys from the PRD, each with its steps and a small piece of the real interface. */
const JOURNEYS = [
  {
    id: 'setup',
    label: 'Set up',
    title: 'From a fresh install to your first tenancy in minutes',
    steps: ['Create your Owner account on first visit', 'Add a property, with flats or HMO rooms as units', 'Add the tenants and their Right to Rent checks', 'Create the tenancy: rent, dates and deposit', 'Invite the tenants to their portal'],
  },
  {
    id: 'rent',
    label: 'Rent month',
    title: 'Rent charges appear by themselves, and late rent gets chased',
    steps: ['Charges are made from each tenancy’s rent and due day', 'A friendly reminder goes before rent is due', 'Record a payment; the balance updates', 'Late payers move to the arrears list and get reminders', 'Tenants see the same ledger in their portal'],
  },
  {
    id: 'repairs',
    label: 'Repairs',
    title: 'A tenant reports it with a photo, a contractor fixes it from a link',
    steps: ['Tenant reports “boiler not working” with a photo', 'You set the priority and assign a contractor', 'The contractor books a visit from a secure link, no login', 'They add photos, mark it done and enter the cost', 'The tenant is emailed at every step'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    title: 'Every certificate on one board, with reminders before they expire',
    steps: ['Upload the gas safety certificate with its expiry date', 'The board shows it as valid', 'Reminders arrive 60, 30 and 7 days before expiry', 'It turns amber, then red, if it isn’t renewed', 'Upload the new one and the reminders stop'],
  },
  {
    id: 'ending',
    label: 'End of tenancy',
    title: 'Notice, deposit return and tidy records afterwards',
    steps: ['Record the notice: the tenancy shows as ending', 'No rent is charged after the last day', 'Record the deposit return and any deductions', 'The tenancy ends and is archived', 'Years later, the tenant’s personal details are anonymised'],
  },
] as const;

function Panel({ id }: { id: (typeof JOURNEYS)[number]['id'] }) {
  if (id === 'setup')
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">New tenancy</p>
        {['Property', 'Tenants', 'Rent and dates', 'Deposit', 'Check and create'].map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span className={cn('grid size-7 place-items-center rounded-full border text-xs font-bold', i < 3 ? 'border-door bg-door text-white' : i === 3 ? 'border-door text-door' : 'border-line-strong text-muted-foreground')}>
              {i < 3 ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn('text-sm', i === 3 ? 'font-semibold' : 'text-muted-foreground')}>{s}</span>
          </div>
        ))}
        <div className="rounded-lg bg-stone px-4 py-3 text-sm">
          <p className="font-semibold">Flat 2, 8 Mill Lane, Halifax</p>
          <p className="text-muted-foreground">Ellie Brennan · £625.00 pcm, due on the 28th</p>
        </div>
      </div>
    );
  if (id === 'rent')
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Rent ledger</p>
          <span className="font-semibold text-bad">£1,575.00 owed</span>
        </div>
        {[
          ['28 Oct', 'Rent 28 Oct – 27 Nov', '£625.00', '', 'Unpaid', 'bad'],
          ['28 Sept', 'Rent 28 Sept – 27 Oct', '£625.00', '', 'Unpaid', 'bad'],
          ['2 Sept', 'Payment (standing order)', '', '£300.00', null, null],
          ['28 Aug', 'Rent 28 Aug – 27 Sept', '£625.00', '', 'Part paid', 'warn'],
        ].map(([d, desc, ch, paid, st, tone], i) => (
          <div key={i} className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 border-b border-border/70 py-2">
            <span className="text-muted-foreground">{d}</span>
            <span>
              {desc} {st ? <StatusBadge tone={tone as 'bad'}>{st}</StatusBadge> : null}
            </span>
            <span className={cn('tabular-nums', paid && 'text-ok')}>{ch || paid}</span>
          </div>
        ))}
        <p className="flex items-center gap-2 pt-1 text-muted-foreground">
          <Mail className="size-4" aria-hidden /> Overdue reminder sent to Ellie, 7 days late
        </p>
      </div>
    );
  if (id === 'repairs')
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info">Scheduled</StatusBadge>
          <StatusBadge tone="warn">Urgent</StatusBadge>
        </div>
        <p className="text-lg font-semibold">#1 Boiler not working</p>
        <div className="flex gap-2">
          <span className="grid size-16 place-items-center rounded-md bg-stone-deep text-muted-foreground">
            <Camera className="size-5" aria-hidden />
          </span>
          <span className="grid size-16 place-items-center rounded-md bg-stone-deep text-muted-foreground">
            <Camera className="size-5" aria-hidden />
          </span>
        </div>
        <ol className="space-y-1.5">
          {[
            ['Tom (tenant)', 'Reported the repair, with 2 photos'],
            ['Sana (team)', 'Assigned to Pennine Heating'],
            ['Gary (contractor)', 'Visit booked for tomorrow, 10:00'],
          ].map(([who, what]) => (
            <li key={who} className="flex gap-2">
              <Wrench className="mt-0.5 size-4 shrink-0 text-door" aria-hidden />
              <span>
                <span className="font-semibold">{who}</span> {what}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  if (id === 'compliance')
    return (
      <div className="space-y-2 text-sm">
        {[
          ['5 Beacon Close', 'Gas safety', 'Expired', 'bad'],
          ['27 Weavers Row', 'EICR', 'Expiring soon', 'warn'],
          ['8 Mill Lane', 'Smoke and CO alarms', 'Missing', 'none'],
          ['14 Calder View Terrace', 'Gas safety', 'Valid', 'ok'],
        ].map(([p, c, s, t]) => (
          <div key={`${p}-${c}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <span>
              <span className="block font-semibold">{p}</span>
              <span className="text-muted-foreground">{c}</span>
            </span>
            <StatusBadge tone={t as 'ok'}>{s}</StatusBadge>
          </div>
        ))}
        <p className="flex items-center gap-2 pt-1 text-muted-foreground">
          <AlarmClock className="size-4" aria-hidden /> Reminders at 60, 30 and 7 days
        </p>
      </div>
    );
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-warn/30 bg-warn-tint px-4 py-3">Notice given by the tenant. The tenancy ends on 29 November.</div>
      <div className="rounded-lg bg-stone px-4 py-3">
        <div className="flex justify-between">
          <span>Deposit</span>
          <span className="tabular-nums">£830.00</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Professional clean</span>
          <span className="tabular-nums">−£95.00</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
          <span>Returned</span>
          <span className="tabular-nums">£735.00</span>
        </div>
      </div>
      <p className="flex items-center gap-2 text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden /> Personal details anonymised after 6 years; rent totals kept
      </p>
    </div>
  );
}

const ICONS = { setup: KeyRound, rent: PoundSterling, repairs: Wrench, compliance: FileText, ending: ShieldCheck } as const;

export function Tour() {
  const [active, setActive] = useState<(typeof JOURNEYS)[number]['id']>('rent');
  const j = JOURNEYS.find((x) => x.id === active)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div role="tablist" aria-label="What OpenLet does" aria-orientation="vertical" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
        {JOURNEYS.map((x) => {
          const Icon = ICONS[x.id];
          return (
            <button
              key={x.id}
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={active === x.id}
              aria-controls={`panel-${x.id}`}
              onClick={() => setActive(x.id)}
              className={cn('flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-left font-semibold text-slate/70 transition-colors hover:bg-paper', active === x.id && 'bg-paper text-door shadow-[inset_3px_0_0_var(--door)]')}
            >
              <Icon className="size-5" aria-hidden /> {x.label}
            </button>
          );
        })}
      </div>
      <div id={`panel-${j.id}`} role="tabpanel" aria-labelledby={`tab-${j.id}`} className="grid gap-6 rounded-xl border border-border bg-paper p-5 md:grid-cols-2 md:p-8">
        <div>
          <h3 className="text-xl leading-snug font-bold">{j.title}</h3>
          <ol className="mt-4 space-y-3">
            {j.steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-door-tint text-xs font-bold text-door">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-lg border border-border bg-stone/40 p-4" aria-label="Example from the app">
          <Panel id={j.id} />
        </div>
      </div>
    </div>
  );
}
