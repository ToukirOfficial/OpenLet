import { cn } from '@/lib/utils';

/** The OpenLet mark: a front door with a brass knob. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 32" aria-hidden="true" className={cn('h-7 w-auto', className)}>
      <path d="M2 31V13C2 6.37 7.37 1 14 1s12 5.37 12 12v18H2Z" fill="var(--door)" />
      <path d="M7 31V14.5a7 7 0 0 1 14 0V31" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M7 12.5h14" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" />
      <circle cx="18" cy="21" r="1.9" fill="var(--brass)" />
    </svg>
  );
}

export function Logo({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className={cn('text-[1.2rem] font-bold tracking-[-0.02em]', tone === 'light' ? 'text-white' : 'text-slate')}>
        Open<span className="font-semibold">Let</span>
      </span>
    </span>
  );
}
