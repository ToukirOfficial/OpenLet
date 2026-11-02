'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { formatDateTime, type AuditRow, type Page } from '@openlet/shared';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApi } from '@/lib/use-api';

const ACTIONS: Record<string, string> = {
  'login.success': 'Logged in',
  'login.failed': 'Failed login',
  'invite.accepted.member': 'Joined the team',
  'invite.accepted.tenant': 'Tenant opened their portal',
  'member.invited': 'Invited a team member',
  'member.removed': 'Removed a team member',
  'member.role.owner': 'Made someone an Owner',
  'member.role.manager': 'Made someone a Manager',
  'member.role.staff': 'Made someone Staff',
  'workspace.created': 'Created the workspace',
  'document.downloaded': 'Downloaded a document',
  'export.requested': 'Requested a data export',
  'export.downloaded': 'Downloaded an export',
  'report.exported': 'Exported a report as CSV',
  'tenant.deleted': 'Deleted a tenant',
  'property.deleted': 'Deleted a property',
  'document.deleted': 'Deleted a document',
  'tenant.anonymised': 'Anonymised a former tenant',
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Page<AuditRow>>(`/audit-log?page=${page}`);
  return (
    <Section title="Audit log" description="Logins, exports, deletions, role changes and document downloads. Entries can’t be edited or removed." flush>
      {loading && !data ? (
        <div className="p-5">
          <ListSkeleton />
        </div>
      ) : error ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : data!.items.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={ShieldCheck} title="Nothing recorded yet">
            Sensitive actions will appear here as they happen.
          </EmptyState>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>IP address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.at)}</TableCell>
                  <TableCell>{r.who}</TableCell>
                  <TableCell>{ACTIONS[r.action] ?? r.action}</TableCell>
                  <TableCell className="text-muted-foreground">{r.ip ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between border-t border-border px-5 py-3">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Newer
            </Button>
            <Button variant="outline" size="sm" disabled={!data!.hasMore} onClick={() => setPage((p) => p + 1)}>
              Older
            </Button>
          </div>
        </>
      )}
    </Section>
  );
}
