'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BellOff, PartyPopper } from 'lucide-react';
import { formatDate, formatPence, type ArrearsItem } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { FilterChips } from '@/components/filter-chips';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApi } from '@/lib/use-api';

export default function RentPage() {
  const [sort, setSort] = useState<'amount' | 'age'>('amount');
  const { data, error, loading, reload } = useApi<{ items: ArrearsItem[]; totalPence: number }>(`/arrears?sort=${sort}`);
  return (
    <>
      <PageHeader title="Rent and arrears" description={data ? (data.items.length ? `${formatPence(data.totalPence)} overdue across ${data.items.length} ${data.items.length === 1 ? 'tenancy' : 'tenancies'}.` : 'Everyone is up to date.') : 'Who owes rent, and for how long.'} />
      <div className="mb-4 flex justify-end">
        <FilterChips<'amount' | 'age'>
          label="Sort by"
          value={sort}
          onChange={(v) => setSort(v || 'amount')}
          options={[
            { value: 'amount', label: 'Biggest first' },
            { value: 'age', label: 'Oldest first' },
          ]}
        />
      </div>
      {loading && !data ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.items.length ? (
        <EmptyState icon={PartyPopper} title="No arrears">
          Every tenancy is paid up to today. Late payments will show here the day after they’re due.
        </EmptyState>
      ) : (
        <div className="rounded-lg border border-border bg-paper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenants</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead>Late by</TableHead>
                <TableHead>Last payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.items.map((a) => (
                <TableRow key={a.tenancyId} className="relative">
                  <TableCell>
                    <Link href={`/app/tenancies/${a.tenancyId}?tab=rent`} className="font-semibold after:absolute after:inset-0 hover:text-door">
                      {a.tenantNames}
                    </Link>
                    {!a.remindersEnabled ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <BellOff className="size-3" aria-hidden /> Reminders off
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{a.address}</TableCell>
                  <TableCell className="text-right font-semibold text-bad tabular-nums">{formatPence(a.arrearsPence)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={a.daysOverdue > 14 ? 'bad' : 'warn'}>{a.daysOverdue} days</StatusBadge>
                    <span className="mt-0.5 block text-xs text-muted-foreground">since {formatDate(a.oldestUnpaidDue)}</span>
                  </TableCell>
                  <TableCell>{a.lastPayment ? formatDate(a.lastPayment) : <span className="text-muted-foreground">None</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
