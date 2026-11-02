'use client';

import Link from 'next/link';
import { useState } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import { FREQUENCY_SHORT, TENANCY_STATUS_LABELS, formatDate, formatPence, type Page, type TenancyListItem, type TenancyStatus } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { FilterChips } from '@/components/filter-chips';
import { SearchInput } from '@/components/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TENANCY_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';
import { Balance } from '@/components/balance';

export default function TenanciesPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TenancyStatus | ''>('');
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) });
  const { data, error, loading, reload } = useApi<Page<TenancyListItem>>(`/tenancies?${params}`);
  return (
    <>
      <PageHeader
        title="Tenancies"
        actions={
          <Button asChild>
            <Link href="/app/tenancies/new">
              <Plus className="size-4" /> New tenancy
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput label="Search tenancies" placeholder="Search by address or tenant" value={q} onChange={setQ} />
        <FilterChips
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: '', label: 'All' }, ...(['ACTIVE', 'ENDING', 'UPCOMING', 'ENDED'] as const).map((s) => ({ value: s, label: TENANCY_STATUS_LABELS[s] }))]}
        />
      </div>
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.items.length ? (
        <EmptyState
          icon={KeyRound}
          title={q || status ? 'No tenancies match' : 'Create your first tenancy'}
          action={
            q || status ? undefined : (
              <Button asChild>
                <Link href="/app/tenancies/new">New tenancy</Link>
              </Button>
            )
          }
        >
          {q || status ? 'Try another search or filter.' : 'Choose a property, add the tenants and set the rent. Charges then appear by themselves.'}
        </EmptyState>
      ) : (
        <div className="rounded-lg border border-border bg-paper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenants</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.items.map((t) => (
                <TableRow key={t.id} className="relative">
                  <TableCell>
                    <Link href={`/app/tenancies/${t.id}`} className="font-semibold after:absolute after:inset-0 hover:text-door">
                      {t.tenantNames}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{t.address}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatPence(t.rentPence)} <span className="text-muted-foreground">{FREQUENCY_SHORT[t.frequency]}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(t.startDate)} – {t.endDate ? formatDate(t.endDate) : 'rolling'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={TENANCY_TONE[t.status]}>{TENANCY_STATUS_LABELS[t.status]}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Balance pence={t.balancePence} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
