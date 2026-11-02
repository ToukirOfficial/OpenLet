'use client';

import { PoundSterling } from 'lucide-react';
import { formatDate, formatPence, type Ledger } from '@openlet/shared';
import { Balance } from '@/components/balance';
import { LedgerTable } from '@/components/ledger-table';
import { StatementButton } from '@/components/statement-button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { useApi } from '@/lib/use-api';

export default function PortalRentPage() {
  const { data, error, loading, reload } = useApi<Ledger>('/portal/ledger');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title font-bold">Rent</h1>
          {data ? (
            <p className="text-lg">
              <Balance pence={data.balancePence} />
              {data.nextDueDate ? <span className="text-muted-foreground"> · next due {formatDate(data.nextDueDate)}</span> : null}
            </p>
          ) : null}
        </div>
        <StatementButton path="/portal/statements" jobsBase="/portal/jobs" size="lg" />
      </div>
      {data && data.arrearsPence > 0 ? (
        <p role="alert" className="rounded-lg border border-bad/25 bg-bad-tint px-4 py-3 text-bad">
          {formatPence(data.arrearsPence)} is overdue. If you’re finding it hard to pay, send a message: it’s always better to talk early.
        </p>
      ) : null}
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.rows.length ? (
        <EmptyState icon={PoundSterling} title="No rent charges yet">
          Your rent will show here up to two weeks before each due date.
        </EmptyState>
      ) : (
        <div className="rounded-lg border border-border bg-paper">
          <LedgerTable rows={data!.rows} />
        </div>
      )}
    </div>
  );
}
