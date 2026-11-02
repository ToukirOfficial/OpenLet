'use client';

import { Input } from '@/components/ui/input';

/** Pounds and pence typed as text ("850" or "850.50"); the form converts to pence with parsePounds. */
export function MoneyInput(props: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">£</span>
      <Input {...props} inputMode="decimal" className="pl-7 tabular-nums" />
    </div>
  );
}
