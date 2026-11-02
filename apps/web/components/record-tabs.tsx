'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Tabs kept in the URL (?tab=), so a refresh or a shared link opens the same tab. */
export function RecordTabs({ tabs, children }: { tabs: { id: string; label: string; count?: number }[]; children: (active: string) => React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const active = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : tabs[0]!.id;
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Sections" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => router.replace(`${path}?tab=${t.id}`, { scroll: false })}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap text-slate/70 hover:text-slate',
              active === t.id && 'border-door text-door',
            )}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-stone-deep px-1.5 text-xs text-slate/80">{t.count}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children(active)}</div>
    </div>
  );
}
