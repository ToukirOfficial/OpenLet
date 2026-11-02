import { Info } from 'lucide-react';
import { LEGAL_NOTE } from '@openlet/shared';
import { cn } from '@/lib/utils';

/** Shown wherever reminders or compliance appear. OpenLet never says a property is "legally compliant". */
export function LegalNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-sm text-muted-foreground', className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {LEGAL_NOTE}
    </p>
  );
}
