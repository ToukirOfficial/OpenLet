'use client';

import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { COMPLIANCE_STATUS_LABELS, DOCUMENT_TYPE_LABELS, formatDate, type ComplianceBoard, type ComplianceCell } from '@openlet/shared';
import { cn } from '@/lib/utils';

const SHORT: Record<ComplianceCell['type'], string> = { GAS_SAFETY: 'Gas safety', EICR: 'EICR', EPC: 'EPC', SMOKE_CO_ALARM: 'Smoke & CO', LICENCE: 'Licence', INSURANCE: 'Insurance' };
const CELL: Record<ComplianceCell['status'], string> = {
  VALID: 'bg-ok-tint text-ok border-ok/20',
  EXPIRING: 'bg-warn-tint text-warn border-warn/30',
  EXPIRED: 'bg-bad-tint text-bad border-bad/30',
  MISSING: 'bg-none-tint text-none border-none/25 border-dashed',
  NOT_NEEDED: 'bg-transparent text-muted-foreground/60 border-transparent',
};

function Cell({ c }: { c: ComplianceCell }) {
  if (c.status === 'NOT_NEEDED')
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
        <Minus className="size-3" aria-hidden /> Not needed
      </span>
    );
  return (
    <span className={cn('flex min-h-11 flex-col justify-center rounded-md border px-2.5 py-1.5 text-xs leading-tight', CELL[c.status])}>
      <span className="flex items-center gap-1 font-semibold">
        {c.status === 'VALID' ? <Check className="size-3" aria-hidden /> : null}
        {COMPLIANCE_STATUS_LABELS[c.status]}
      </span>
      {c.expiresOn ? <span className="opacity-90">{c.status === 'EXPIRED' ? 'since' : 'to'} {formatDate(c.expiresOn)}</span> : c.status === 'VALID' ? <span>No expiry</span> : <span>Upload it</span>}
    </span>
  );
}

/** Every property against every certificate type: the compliance board. */
export function ComplianceGrid({ board, linkTab = 'documents' }: { board: ComplianceBoard; linkTab?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-paper">
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">Certificate status for each property</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-4 py-3 font-semibold">
              Property
            </th>
            {board.types.map((t) => (
              <th key={t} scope="col" className="px-2 py-3 font-semibold" title={DOCUMENT_TYPE_LABELS[t]}>
                {SHORT[t]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {board.rows.map((r) => (
            <tr key={r.propertyId} className="border-b border-border/70 last:border-0">
              <th scope="row" className="max-w-56 px-4 py-2.5 text-left font-medium">
                <Link href={`/app/properties/${r.propertyId}?tab=${linkTab}`} className="hover:text-door hover:underline">
                  {r.address}
                </Link>
              </th>
              {r.cells.map((c) => (
                <td key={c.type} className="px-2 py-2.5 align-middle">
                  <Cell c={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
