'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import type { RepairListItem } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { FilterChips } from '@/components/filter-chips';
import { RepairRows } from '@/components/repair-list';
import { SearchInput } from '@/components/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';

type F = 'OPEN' | 'COMPLETED' | 'CLOSED' | '';

export default function RepairsPage() {
  const [status, setStatus] = useState<F>('OPEN');
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) });
  const { data, error, loading, reload } = useApi<{ items: RepairListItem[] }>(`/repairs?${params}`);
  return (
    <>
      <PageHeader
        title="Repairs"
        description="Reported by tenants or logged by your team. Overdue ones are at the top."
        actions={
          <Button asChild>
            <Link href="/app/repairs/new">
              <Plus className="size-4" /> Log a repair
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput label="Search repairs" placeholder="Search by title, address or #number" value={q} onChange={setQ} />
        <FilterChips<F>
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'OPEN', label: 'Open' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CLOSED', label: 'Closed' },
            { value: '', label: 'All' },
          ]}
        />
      </div>
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.items.length ? (
        <EmptyState icon={Wrench} title={status === 'OPEN' && !q ? 'No open repairs' : 'No repairs match'}>
          {status === 'OPEN' && !q ? 'Nice. When a tenant reports something, it lands here.' : 'Try another filter or search.'}
        </EmptyState>
      ) : (
        <RepairRows items={data!.items} />
      )}
    </>
  );
}
