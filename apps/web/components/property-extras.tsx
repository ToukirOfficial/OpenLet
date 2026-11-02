'use client';

import { COMPLIANCE_STATUS_LABELS, DOCUMENT_TYPE_LABELS, LEGAL_NOTE, formatDate, type ComplianceBoard } from '@openlet/shared';
import { RepairsFor } from '@/components/repair-list';
import { Section } from '@/components/section';
import { StatusBadge } from '@/components/status-badge';
import { COMPLIANCE_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';

export function PropertyRepairs({ propertyId }: { propertyId: string }) {
  return <RepairsFor query={`propertyId=${propertyId}`} emptyText="Repairs reported by tenants or logged by your team will be listed here." newHref={`/app/repairs/new?propertyId=${propertyId}`} />;
}

export function PropertyCompliance({ propertyId }: { propertyId: string }) {
  const { data } = useApi<ComplianceBoard>(`/compliance?propertyId=${propertyId}`);
  if (!data?.rows[0]) return null;
  const cells = data.rows[0].cells.filter((c) => c.status !== 'NOT_NEEDED');
  return (
    <Section title="Certificates" description={LEGAL_NOTE}>
      <ul className="flex flex-wrap gap-2">
        {cells.map((c) => (
          <li key={c.type}>
            <StatusBadge tone={COMPLIANCE_TONE[c.status as 'VALID']} className="text-sm">
              {DOCUMENT_TYPE_LABELS[c.type]}: {COMPLIANCE_STATUS_LABELS[c.status as 'VALID'].toLowerCase()}
              {c.expiresOn ? ` (${formatDate(c.expiresOn)})` : ''}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </Section>
  );
}
