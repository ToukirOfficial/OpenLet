'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { useRole } from '@/lib/session';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { href: '/app/settings', label: 'Workspace', who: 'manager' },
  { href: '/app/settings/team', label: 'Team', who: 'owner' },
  { href: '/app/settings/audit', label: 'Audit log', who: 'owner' },
  { href: '/app/settings/account', label: 'Your account', who: 'all' },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { isOwner, isManager } = useRole();
  const visible = SECTIONS.filter((s) => s.who === 'all' || (s.who === 'owner' ? isOwner : isManager));
  return (
    <>
      <PageHeader title="Settings" description="How this workspace works, who’s in the team, and your own account." />
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Settings" className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:flex-col">
          {visible.map((s) => {
            const active = path === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className={cn('rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-slate/75 hover:bg-stone-deep', active && 'bg-paper text-slate shadow-[inset_3px_0_0_var(--door)]')}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
