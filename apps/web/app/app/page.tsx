'use client';

import Link from 'next/link';
import { Building2, KeyRound, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/app-shell';
import { Section } from '@/components/section';
import { useSession } from '@/lib/session';

const STEPS = [
  { href: '/app/properties/new', icon: Building2, title: 'Add a property', text: 'Address, type and rooms. Flats or HMO rooms become units.' },
  { href: '/app/tenants/new', icon: Users, title: 'Add a tenant', text: 'Name and contact details, plus their Right to Rent check.' },
  { href: '/app/tenancies/new', icon: KeyRound, title: 'Create a tenancy', text: 'Rent, dates and deposit. Rent charges then appear by themselves.' },
  { href: '/app/settings/team', icon: UserPlus, title: 'Invite your team', text: 'Managers and staff each get their own login.' },
];

export default function DashboardPage() {
  const { me, workspace } = useSession();
  return (
    <>
      <PageHeader title={`Good to see you, ${me.name.split(' ')[0]}`} description={`${workspace?.name} at a glance.`} />
      <Section title="Get started" description="Four steps to your first rent month.">
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.href}>
              <Link href={s.href} className="flex h-full gap-4 rounded-lg border border-border p-4 transition-colors hover:border-door/40 hover:bg-door-tint/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-door-tint font-bold text-door">{i + 1}</span>
                <span>
                  <span className="flex items-center gap-2 font-semibold">
                    <s.icon className="size-4 text-door" aria-hidden /> {s.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{s.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
