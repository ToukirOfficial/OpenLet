'use client';

import { Download, FileText } from 'lucide-react';
import { DOCUMENT_TYPE_LABELS, formatDate, type DocumentItem } from '@openlet/shared';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { apiUrl } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function PortalDocumentsPage() {
  const { data, error, loading, reload } = useApi<DocumentItem[]>('/portal/documents');
  return (
    <div className="space-y-5">
      <h1 className="text-title font-bold">Documents</h1>
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.length ? (
        <EmptyState icon={FileText} title="No documents shared yet">
          Your tenancy agreement and certificates like gas safety will appear here when your landlord or agent shares them.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-paper">
          {data!.map((d) => (
            <li key={d.id}>
              <a href={apiUrl(`/portal/documents/${d.id}/download`)} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone">
                <FileText className="size-5 shrink-0 text-door" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{d.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[d.type]}
                    {d.expiresOn ? `, valid to ${formatDate(d.expiresOn)}` : ''}
                  </span>
                </span>
                <Download className="size-5 text-muted-foreground" aria-label="Download" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
