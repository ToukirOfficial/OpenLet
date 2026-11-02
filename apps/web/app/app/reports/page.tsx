'use client';

import { Suspense, useState } from 'react';
import { Archive, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { FREQUENCY_SHORT, TENANCY_STATUS_LABELS, addDays, formatDate, formatPence, londonDate, type ArrearsItem, type IncomeReport, type JobInfo, type MaintenanceRow, type RentFrequency, type RentRollRow, type TenancyStatus } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Balance } from '@/components/balance';
import { RecordTabs } from '@/components/record-tabs';
import { Section } from '@/components/section';
import { ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { waitAndDownload } from '@/lib/jobs';
import { useRole } from '@/lib/session';
import { useApi } from '@/lib/use-api';

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

function CsvButton({ kind, range }: { kind: string; range?: { from: string; to: string } }) {
  const { isManager } = useRole();
  const [busy, setBusy] = useState(false);
  if (!isManager) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const q = range ? `?from=${range.from}&to=${range.to}` : '';
          await waitAndDownload(await api<JobInfo>(`/reports/${kind}/csv${q}`, { method: 'POST' }));
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDown className="size-4" /> {busy ? 'Preparing…' : 'Download CSV'}
    </Button>
  );
}

function Range({ range, onChange }: { range: { from: string; to: string }; onChange: (r: { from: string; to: string }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2">
        From <Input type="date" className="h-9 w-40" value={range.from} onChange={(e) => onChange({ ...range, from: e.target.value })} />
      </label>
      <label className="flex items-center gap-2">
        to <Input type="date" className="h-9 w-40" value={range.to} onChange={(e) => onChange({ ...range, to: e.target.value })} />
      </label>
    </div>
  );
}

function RentRoll() {
  const { data, error, reload } = useApi<RentRollRow[]>('/reports/rent-roll');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <ListSkeleton />;
  return (
    <Section title="Rent roll" description="Every current and upcoming tenancy, with its rent and balance today." actions={<CsvButton kind="rent-roll" />} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Tenants</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Rent</TableHead>
            <TableHead>Term</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.tenancyId}>
              <TableCell className="max-w-64">{r.address}</TableCell>
              <TableCell>{r.tenantNames}</TableCell>
              <TableCell>{TENANCY_STATUS_LABELS[r.status as TenancyStatus]}</TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {formatPence(r.rentPence)} <span className="text-muted-foreground">{FREQUENCY_SHORT[r.frequency as RentFrequency]}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(r.startDate)} – {r.endDate ? formatDate(r.endDate) : 'rolling'}
              </TableCell>
              <TableCell className="text-right">
                <Balance pence={r.balancePence} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function Income() {
  const [range, setRange] = useState({ from: `${addDays(londonDate(), -365).slice(0, 7)}-01`, to: londonDate() });
  const { data, error, reload } = useApi<IncomeReport>(`/reports/income?from=${range.from}&to=${range.to}`);
  return (
    <Section title="Income" description="Rent received per month and property (payments recorded, less any reversed)." actions={<CsvButton kind="income" range={range} />} flush>
      <div className="border-b border-border px-5 py-3">
        <Range range={range} onChange={setRange} />
      </div>
      {error ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : !data ? (
        <div className="p-5">
          <ListSkeleton />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="sticky left-0 bg-paper px-4 py-2.5 font-semibold">Property</th>
                {data.months.map((m) => (
                  <th key={m} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {MONTH.format(new Date(`${m}-01T00:00:00Z`))}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.propertyId} className="border-b border-border/70">
                  <th scope="row" className="sticky left-0 max-w-56 truncate bg-paper px-4 py-2.5 text-left font-medium">
                    {r.address}
                  </th>
                  {r.byMonth.map((p, i) => (
                    <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                      {p ? formatPence(p) : <span className="text-muted-foreground">–</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatPence(r.totalPence)}</td>
                </tr>
              ))}
              <tr className="bg-stone/70 font-semibold">
                <th scope="row" className="sticky left-0 bg-stone px-4 py-2.5 text-left">
                  Total
                </th>
                {data.totals.map((p, i) => (
                  <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                    {formatPence(p)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right tabular-nums">{formatPence(data.totalPence)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Arrears() {
  const { data, error, reload } = useApi<{ items: ArrearsItem[]; totalPence: number }>('/reports/arrears');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <ListSkeleton />;
  return (
    <Section title="Arrears" description={`${formatPence(data.totalPence)} overdue in total.`} actions={<CsvButton kind="arrears" />} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenants</TableHead>
            <TableHead>Property</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
            <TableHead>Days late</TableHead>
            <TableHead>Last payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.length ? (
            data.items.map((a) => (
              <TableRow key={a.tenancyId}>
                <TableCell className="font-medium">{a.tenantNames}</TableCell>
                <TableCell>{a.address}</TableCell>
                <TableCell className="text-right font-semibold text-bad tabular-nums">{formatPence(a.arrearsPence)}</TableCell>
                <TableCell>{a.daysOverdue}</TableCell>
                <TableCell>{a.lastPayment ? formatDate(a.lastPayment) : 'None'}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                No arrears. Everyone is paid up to today.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Section>
  );
}

function Maintenance() {
  const [range, setRange] = useState({ from: `${londonDate().slice(0, 4)}-01-01`, to: londonDate() });
  const { data, error, reload } = useApi<MaintenanceRow[]>(`/reports/maintenance?from=${range.from}&to=${range.to}`);
  const total = (data ?? []).reduce((s, r) => s + r.costPence, 0);
  return (
    <Section title="Maintenance costs" description={data ? `${formatPence(total)} on repairs reported in this period.` : undefined} actions={<CsvButton kind="maintenance" range={range} />} flush>
      <div className="border-b border-border px-5 py-3">
        <Range range={range} onChange={setRange} />
      </div>
      {error ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : !data ? (
        <div className="p-5">
          <ListSkeleton />
        </div>
      ) : !data.length ? (
        <p className="px-5 py-6 text-center text-muted-foreground">No repair costs recorded in this period.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((r) => (
            <li key={r.propertyId} className="px-5 py-3">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{r.address}</span>
                <span className="font-semibold tabular-nums">{formatPence(r.costPence)}</span>
              </div>
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {r.items.map((i) => (
                  <li key={i.reference} className="flex justify-between gap-3">
                    <span>
                      #{i.reference} {i.title}, {formatDate(i.date)}
                      {i.contractor ? `, ${i.contractor}` : ''}
                    </span>
                    <span className="tabular-nums">{formatPence(i.costPence)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function FullExport() {
  const { isOwner } = useRole();
  const [busy, setBusy] = useState(false);
  if (!isOwner) return null;
  return (
    <Section title="Export everything" description="Every record as CSV plus all documents, in one zip file. Use it for backups or to move to another system. Only Owners can do this, and it’s recorded in the audit log.">
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await waitAndDownload(await api<JobInfo>('/exports', { method: 'POST' }), '/jobs', 180_000);
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Archive className="size-4" /> {busy ? 'Preparing your export…' : 'Download full export'}
      </Button>
    </Section>
  );
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Rent roll, income, arrears and maintenance costs. Download any of them as CSV." />
      <Suspense>
        <RecordTabs
          tabs={[
            { id: 'rent-roll', label: 'Rent roll' },
            { id: 'income', label: 'Income' },
            { id: 'arrears', label: 'Arrears' },
            { id: 'maintenance', label: 'Maintenance' },
          ]}
        >
          {(tab) => (tab === 'rent-roll' ? <RentRoll /> : tab === 'income' ? <Income /> : tab === 'arrears' ? <Arrears /> : <Maintenance />)}
        </RecordTabs>
      </Suspense>
      <div className="mt-6">
        <FullExport />
      </div>
    </>
  );
}
