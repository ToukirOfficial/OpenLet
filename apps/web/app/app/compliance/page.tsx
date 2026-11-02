'use client';

import { ClipboardCheck } from 'lucide-react';
import { COMPLIANCE_STATUS_LABELS, type ComplianceBoard } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { ComplianceGrid } from '@/components/compliance-grid';
import { LegalNote } from '@/components/legal-note';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { COMPLIANCE_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';

export default function CompliancePage() {
  const { data, error, loading, reload } = useApi<ComplianceBoard>('/compliance');
  return (
    <>
      <PageHeader title="Compliance" description="Certificates for every property. Expiring means 60 days or fewer left. Reminders go to Owners and Managers." />
      {loading && !data ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.rows.length ? (
        <EmptyState icon={ClipboardCheck} title="No properties yet">
          Add a property, then upload its certificates with their expiry dates.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['EXPIRED', 'MISSING', 'EXPIRING', 'VALID'] as const).map((s) => (
              <StatusBadge key={s} tone={COMPLIANCE_TONE[s]} className="text-sm">
                {data!.counts[s]} {COMPLIANCE_STATUS_LABELS[s].toLowerCase()}
              </StatusBadge>
            ))}
          </div>
          <ComplianceGrid board={data!} />
          <p className="text-sm text-muted-foreground">Which certificates count as required is set in Settings. Gas safety only applies to properties with gas, and licences only to HMOs.</p>
          <LegalNote />
        </div>
      )}
    </>
  );
}
