import { cn } from '@/lib/utils';

export type Tone = 'ok' | 'warn' | 'bad' | 'none' | 'info' | 'neutral' | 'door';

const TONES: Record<Tone, string> = {
  ok: 'bg-ok-tint text-ok',
  warn: 'bg-warn-tint text-warn',
  bad: 'bg-bad-tint text-bad',
  none: 'bg-none-tint text-none',
  info: 'bg-info-tint text-info',
  neutral: 'bg-stone-deep text-slate/80',
  door: 'bg-door-tint text-door',
};
const DOTS: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', none: 'bg-none', info: 'bg-info', neutral: 'bg-slate/50', door: 'bg-door' };

/** A status in words with a colour, never colour alone. */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>
      <span className={cn('size-1.5 rounded-full', DOTS[tone])} aria-hidden />
      {children}
    </span>
  );
}
