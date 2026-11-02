'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { formatDate, londonDate, type Page, type TenantListItem } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { SearchInput } from '@/components/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApi } from '@/lib/use-api';
import { PORTAL_LABEL } from '@/lib/tones';


export default function TenantsPage() {
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useApi<Page<TenantListItem>>(`/tenants${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const today = londonDate();
  return (
    <>
      <PageHeader
        title="Tenants"
        description={data?.total !== undefined ? `${data.total} ${data.total === 1 ? 'tenant' : 'tenants'}` : undefined}
        actions={
          <Button asChild>
            <Link href="/app/tenants/new">
              <Plus className="size-4" /> Add tenant
            </Link>
          </Button>
        }
      />
      <div className="mb-4">
        <SearchInput label="Search tenants" placeholder="Search by name, email or phone" value={q} onChange={setQ} />
      </div>
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.items.length ? (
        <EmptyState
          icon={Users}
          title={q ? 'No tenants match' : 'Add your first tenant'}
          action={
            q ? undefined : (
              <Button asChild>
                <Link href="/app/tenants/new">Add tenant</Link>
              </Button>
            )
          }
        >
          {q ? 'Check the spelling or search by email.' : 'Add tenants before creating their tenancy. Joint tenants each get their own record.'}
        </EmptyState>
      ) : (
        <div className="rounded-lg border border-border bg-paper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Lives at</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Right to Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.items.map((t) => (
                <TableRow key={t.id} className="relative">
                  <TableCell>
                    <Link href={`/app/tenants/${t.id}`} className="font-semibold after:absolute after:inset-0 hover:text-door">
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{t.currentAddress ?? <span className="text-muted-foreground">No current tenancy</span>}</TableCell>
                  <TableCell>
                    <span className="block">{t.email ?? '—'}</span>
                    <span className="block text-sm text-muted-foreground">{t.phone}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={PORTAL_LABEL[t.portal][1]}>{PORTAL_LABEL[t.portal][0]}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {t.rightToRentDue ? (
                      <StatusBadge tone={t.rightToRentDue < today ? 'bad' : 'warn'}>Follow-up by {formatDate(t.rightToRentDue)}</StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
