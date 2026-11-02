import { formatPence } from '@openlet/shared';
import { cn } from '@/lib/utils';

/** A balance in words as well as colour: "£120.00 owed", "£40.00 in credit", "Paid up". */
export function Balance({ pence, className }: { pence: number; className?: string }) {
  if (pence > 0) return <span className={cn('font-semibold text-bad tabular-nums', className)}>{formatPence(pence)} owed</span>;
  if (pence < 0) return <span className={cn('font-semibold text-ok tabular-nums', className)}>{formatPence(-pence)} in credit</span>;
  return <span className={cn('text-ok', className)}>Paid up</span>;
}
