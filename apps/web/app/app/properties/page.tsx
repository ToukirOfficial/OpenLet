'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Plus, Wrench } from 'lucide-react';
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS, type Page, type PropertyListItem, type PropertyStatus } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { FilterChips } from '@/components/filter-chips';
import { SearchInput } from '@/components/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApi } from '@/lib/use-api';
import { PROPERTY_TONE } from '@/lib/tones';

function List() {
  const initial = (useSearchParams().get('status') ?? '') as PropertyStatus | '';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PropertyStatus | ''>(initial);
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) });
  const { data, error, loading, reload } = useApi<Page<PropertyListItem>>(`/properties?${params}`);
  const filtered = !!q || !!status;

  return (
    <>
      <PageHeader
        title="Properties"
        description={data?.total !== undefined ? `${data.total} ${data.total === 1 ? 'property' : 'properties'}` : 'Every property you let.'}
        actions={
          <Button asChild>
            <Link href="/app/properties/new">
              <Plus className="size-4" /> Add property
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput label="Search properties" placeholder="Search by address or postcode" value={q} onChange={setQ} />
        <FilterChips
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: '', label: 'All' }, ...(['OCCUPIED', 'VACANT', 'ENDING_SOON'] as const).map((s) => ({ value: s, label: PROPERTY_STATUS_LABELS[s] }))]}
        />
      </div>
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.items.length ? (
        filtered ? (
          <EmptyState icon={Building2} title="No properties match">
            Try a shorter search, or clear the status filter.
          </EmptyState>
        ) : (
          <EmptyState
            icon={Building2}
            title="Add your first property"
            action={
              <Button asChild>
                <Link href="/app/properties/new">Add property</Link>
              </Button>
            }
          >
            Start with the address. You can add flats or rooms as separate units.
          </EmptyState>
        )
      ) : (
        <div className="rounded-lg border border-border bg-paper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Let</TableHead>
                <TableHead>Open repairs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.items.map((p) => (
                <TableRow key={p.id} className="relative">
                  <TableCell>
                    <Link href={`/app/properties/${p.id}`} className="font-semibold after:absolute after:inset-0 hover:text-door">
                      {p.addressLine1}
                    </Link>
                    <span className="block text-sm text-muted-foreground">
                      {p.town}, {p.postcode}
                    </span>
                  </TableCell>
                  <TableCell>
                    {PROPERTY_TYPE_LABELS[p.type]}, {p.bedrooms} bed
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={PROPERTY_TONE[p.status]}>{PROPERTY_STATUS_LABELS[p.status]}</StatusBadge>
                  </TableCell>
                  <TableCell className="tabular">
                    {p.letUnits} of {p.unitCount}
                  </TableCell>
                  <TableCell>
                    {p.openRepairs ? (
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Wrench className="size-3.5 text-warn" aria-hidden /> {p.openRepairs}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
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

export default function PropertiesPage() {
  return (
    <Suspense>
      <List />
    </Suspense>
  );
}
