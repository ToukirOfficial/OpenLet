'use client';

import { formatDate, formatPence, type LedgerRow } from '@openlet/shared';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const STATUS = { PAID: ['Paid', 'ok'], PART_PAID: ['Part paid', 'warn'], UNPAID: ['Unpaid', 'bad'], UPCOMING: ['Upcoming', 'info'] } as const;

/** The rent ledger, newest first, with a running balance. Shared by the staff app and the tenant portal. */
export function LedgerTable({ rows, action }: { rows: LedgerRow[]; action?: (r: LedgerRow) => React.ReactNode }) {
  const list = [...rows].reverse();
  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Charged</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            {action ? <TableHead><span className="sr-only">Actions</span></TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((r) => (
            <TableRow key={r.id} className={cn('align-top', (r.reversed || r.type === 'REVERSAL') && 'text-muted-foreground')}>
              <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
              <TableCell>
                <span className={cn('block font-medium', r.reversed && 'line-through')}>{r.description}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {r.status ? <StatusBadge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}{r.status === 'PART_PAID' ? `, ${formatPence(r.outstandingPence)} left` : ''}</StatusBadge> : null}
                  {r.reversed ? <StatusBadge tone="neutral">Reversed</StatusBadge> : null}
                  {r.reference ? <span>Ref {r.reference}</span> : null}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.signedPence > 0 ? formatPence(r.signedPence) : ''}</TableCell>
              <TableCell className="text-right tabular-nums text-ok">{r.signedPence < 0 ? formatPence(-r.signedPence) : ''}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{r.runningBalancePence < 0 ? `${formatPence(-r.runningBalancePence)} cr` : formatPence(r.runningBalancePence)}</TableCell>
              {action ? <TableCell className="text-right">{action(r)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
</Table>
  );
}
