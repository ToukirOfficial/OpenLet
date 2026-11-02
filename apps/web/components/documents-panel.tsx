'use client';

import { useRef, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, formatDate, formatDateTime, londonDate, type DocumentItem, type DocumentType } from '@openlet/shared';
import { Confirm } from '@/components/confirm';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { api, apiUrl, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/use-api';

type Owner = { propertyId?: string; tenancyId?: string; tenantId?: string; repairId?: string };

export function expiryBadge(expiresOn: string | null) {
  if (!expiresOn) return null;
  const today = londonDate();
  const days = Math.round((Date.parse(expiresOn) - Date.parse(today)) / 86_400_000);
  if (days < 0) return <StatusBadge tone="bad">Expired {formatDate(expiresOn)}</StatusBadge>;
  if (days <= 60) return <StatusBadge tone="warn">Expires {formatDate(expiresOn)}</StatusBadge>;
  return <StatusBadge tone="ok">Valid to {formatDate(expiresOn)}</StatusBadge>;
}

function UploadForm({ owner, types, defaultShare, onDone }: { owner: Owner; types: readonly DocumentType[]; defaultShare: boolean; onDone: () => void }) {
  const [type, setType] = useState<DocumentType>(types[0]!);
  const [title, setTitle] = useState('');
  const [issuedOn, setIssuedOn] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [share, setShare] = useState(defaultShare);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return setError('Choose a file to upload.');
        const body = new FormData();
        body.append('type', type);
        if (title) body.append('title', title);
        if (issuedOn) body.append('issuedOn', issuedOn);
        if (expiresOn) body.append('expiresOn', expiresOn);
        body.append('sharedWithTenant', String(share));
        for (const [k, v] of Object.entries(owner)) if (v) body.append(k, v);
        body.append('file', file);
        setPending(true);
        setError(null);
        try {
          await api('/documents', { method: 'POST', body });
          toast.success('Document uploaded');
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <FormError message={error} />
      <Field label="Type">
        {(p) => (
          <NativeSelect {...p} value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label="Title" optional hint={`Leave blank to use “${DOCUMENT_TYPE_LABELS[type]}”.`}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Issued on" optional>
          {(p) => <Input {...p} type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />}
        </Field>
        <Field label="Expires on" optional hint="Certificates with an expiry date get reminders.">
          {(p) => <Input {...p} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />}
        </Field>
      </div>
      <Field label="File" hint="PDF, JPEG, PNG or HEIC.">
        {(p) => <Input {...p} type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
      </Field>
      <label className="flex items-center gap-3">
        <Switch checked={share} onCheckedChange={setShare} />
        <span className="text-sm">Share with the tenant in their portal</span>
      </label>
      <Button type="submit" disabled={pending}>
        <Upload className="size-4" /> {pending ? 'Uploading…' : 'Upload'}
      </Button>
    </form>
  );
}

/** Documents attached to one record: upload, share with the tenant, download, delete. */
export function DocumentsPanel({ owner, types = DOCUMENT_TYPES, title = 'Documents', description, defaultShare = false, showShare = true }: { owner: Owner; types?: readonly DocumentType[]; title?: string; description?: string; defaultShare?: boolean; showShare?: boolean }) {
  const query = new URLSearchParams(Object.entries(owner).filter(([, v]) => v) as [string, string][]).toString();
  const { data, error, loading, reload } = useApi<DocumentItem[]>(`/documents?${query}`);
  const [open, setOpen] = useState(false);
  const busy = useRef(false);

  async function toggleShare(d: DocumentItem, shared: boolean) {
    if (busy.current) return;
    busy.current = true;
    try {
      await api(`/documents/${d.id}`, { method: 'PATCH', body: { sharedWithTenant: shared } });
      toast.success(shared ? 'Shared with the tenant' : 'No longer shared');
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busy.current = false;
    }
  }

  return (
    <Section
      title={title}
      description={description}
      flush
      actions={
        <FormDialog title="Upload a document" open={open} onOpenChange={setOpen} trigger={<Button size="sm"><Upload className="size-4" /> Upload</Button>}>
          <UploadForm
            owner={owner}
            types={types}
            defaultShare={defaultShare}
            onDone={() => {
              setOpen(false);
              void reload();
            }}
          />
        </FormDialog>
      }
    >
      {loading && !data ? (
        <div className="p-5">
          <ListSkeleton rows={3} />
        </div>
      ) : error ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : !data!.length ? (
        <div className="p-5">
          <EmptyState icon={FileText} title="No documents yet">
            Upload certificates, agreements and photos. They’re stored privately and only shared with tenants when you choose.
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data!.map((d) => (
            <li key={d.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-stone-deep text-slate/70">
                  {d.mime.startsWith('image/') ? <ImageIcon className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[d.type]} · added {formatDateTime(d.createdAt)}
                    {d.uploadedBy !== 'STAFF' ? ` by the ${d.uploadedBy === 'TENANT' ? 'tenant' : 'contractor'}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {expiryBadge(d.expiresOn)}
                    {!d.ready ? <StatusBadge tone="info">Processing photo…</StatusBadge> : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showShare ? (
                  <label className="mr-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch checked={d.sharedWithTenant} onCheckedChange={(v) => void toggleShare(d, v)} aria-label={`Share ${d.title} with the tenant`} />
                    Shared
                  </label>
                ) : null}
                <Button asChild variant="outline" size="sm" disabled={!d.ready}>
                  <a href={apiUrl(`/documents/${d.id}/download`)} aria-label={`Download ${d.title}`}>
                    <Download className="size-4" />
                  </a>
                </Button>
                <Confirm
                  title={`Delete ${d.title}?`}
                  description="The file is removed for good. The deletion is recorded in the audit log."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={async () => {
                    await api(`/documents/${d.id}`, { method: 'DELETE' });
                    toast.success('Document deleted');
                    await reload();
                  }}
                >
                  <Button variant="ghost" size="sm" aria-label={`Delete ${d.title}`}>
                    <Trash2 className="size-4 text-bad" />
                  </Button>
                </Confirm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
