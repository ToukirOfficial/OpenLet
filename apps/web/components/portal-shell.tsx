'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, LogOut, MessageSquare, PoundSterling, UserRound, Wrench } from 'lucide-react';
import { LogoMark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { DemoBanner } from '@/components/demo-banner';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/rent', label: 'Rent', icon: PoundSterling },
  { href: '/portal/repairs', label: 'Repairs', icon: Wrench },
  { href: '/portal/documents', label: 'Documents', icon: FileText },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
];

/** Tenant portal: phone first, big tap targets, a tab bar at the bottom on small screens. */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { tenancy, me, logout, switchWorkspace } = useSession();
  const active = (href: string) => (href === '/portal' ? path === '/portal' : path.startsWith(href));
  return (
    <div className="min-h-dvh pb-24 sm:pb-10">
      <DemoBanner />
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5" aria-label="Portal home">
            <LogoMark className="h-8" />
            <span className="min-w-0">
              <span className="block truncate text-[0.95rem] font-bold leading-tight">{tenancy?.workspaceName}</span>
              <span className="block text-xs text-muted-foreground">Tenant portal</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {me.tenancies.length > 1 ? (
              <select
                aria-label="Choose landlord"
                className="h-10 max-w-36 rounded-md border border-input bg-paper px-2 text-sm"
                value={tenancy?.workspaceId}
                onChange={(e) => switchWorkspace(e.target.value)}
              >
                {me.tenancies.map((t) => (
                  <option key={t.workspaceId} value={t.workspaceId}>
                    {t.workspaceName}
                  </option>
                ))}
              </select>
            ) : null}
            <Button asChild variant="ghost" size="icon" aria-label="My details">
              <Link href="/portal/details">
                <UserRound className="size-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={() => void logout()}>
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
        <nav aria-label="Portal" className="mx-auto hidden max-w-3xl gap-1 px-4 pb-2 sm:flex">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active(t.href) ? 'page' : undefined}
              className={cn('rounded-md px-3 py-2 text-sm font-medium text-slate/75 hover:bg-stone-deep', active(t.href) && 'bg-door-tint text-door')}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6">
        {children}
      </main>
      <nav aria-label="Portal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper pb-[env(safe-area-inset-bottom)] sm:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active(t.href) ? 'page' : undefined}
                className={cn('flex min-h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-medium text-slate/70', active(t.href) && 'text-door')}
              >
                <t.icon className="size-5" aria-hidden />
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
