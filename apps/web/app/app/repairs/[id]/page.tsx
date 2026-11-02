'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AlarmClock, ImagePlus, Link2Off, Lock, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  REPAIR_CATEGORY_LABELS,
  REPAIR_PRIORITIES,
  REPAIR_PRIORITY_LABELS,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  formatDateTime,
  formatPence,
  parsePounds,
  penceToInput,
  type ContractorItem,
  type RepairDetail,
  type RepairPriority,
  type RepairStatus,
} from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Confirm } from '@/components/confirm';
import { MoneyInput } from '@/components/money-input';
import { Section } from '@/components/section';
import { ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, apiUrl, errorMessage } from '@/lib/api';
import { PRIORITY_TONE, REPAIR_STATUS_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

const WHO = { STAFF: 'Team', TENANT: 'Tenant', CONTRACTOR: 'Contractor', SYSTEM: 'OpenLet' } as const;

function useAction(set: (r: RepairDetail) => void) {
  const [pending, setPending] = useState(false);
  return {
    pending,
    run: async (path: string, method: 'POST' | 'PATCH', body: unknown, ok: string) => {
      setPending(true);
      try {
        set(await api<RepairDetail>(path, { method, body }));
        toast.success(ok);
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      } finally {
        setPending(false);
      }
    },
  };
}

function Photos({ r, reload }: { r: RepairDetail; reload: () => void }) {
  const [uploading, setUploading] = useState(false);
  return (
    <Section
      title="Photos"
      actions={
        <label className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm font-semibold hover:bg-stone', uploading && 'pointer-events-none opacity-60')}>
          <ImagePlus className="size-4" aria-hidden /> {uploading ? 'Uploading…' : 'Add photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,.heic"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const body = new FormData();
              body.append('type', 'PHOTO');
              body.append('repairId', r.id);
              body.append('title', `Photo for repair #${r.reference}`);
              body.append('sharedWithTenant', 'true');
              body.append('file', file);
              setUploading(true);
              try {
                await api('/documents', { method: 'POST', body });
                reload();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      }
    >
      {!r.photos.length ? (
        <p className="text-sm text-muted-foreground">No photos yet. Tenants and contractors can add them too.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {r.photos.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-md bg-stone-deep">
              {p.ready ? (
                <a href={apiUrl(`/documents/${p.id}/download?inline=1`)} target="_blank" rel="noreferrer">
                  <img src={apiUrl(`/documents/${p.id}/download?inline=1`)} alt={`Photo added by ${WHO[p.uploadedBy].toLowerCase()}`} className="size-full object-cover" />
                </a>
              ) : (
                <span className="grid size-full place-items-center text-xs text-muted-foreground">Processing…</span>
              )}
              <span className="absolute bottom-1 left-1 rounded bg-slate/70 px-1.5 text-[0.7rem] text-white">{WHO[p.uploadedBy]}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Activity({ r, set }: { r: RepairDetail; set: (r: RepairDetail) => void }) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const { pending, run } = useAction(set);
  return (
    <Section title="Updates and comments" description="Comments you share are shown to the tenant in their portal. Internal ones never are.">
      <ol className="mb-5 space-y-3">
        {r.events.map((e) => (
          <li key={e.id} className={cn('rounded-md border px-3 py-2.5', e.visibility === 'INTERNAL' ? 'border-brass/30 bg-brass-tint/50' : 'border-border bg-stone/60')}>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-slate">{e.actorName ?? WHO[e.actorType]}</span>
              <span>({WHO[e.actorType]})</span>
              <span>{formatDateTime(e.createdAt)}</span>
              {e.visibility === 'INTERNAL' ? (
                <span className="inline-flex items-center gap-1 font-semibold text-warn">
                  <Lock className="size-3" aria-hidden /> Internal
                </span>
              ) : null}
            </p>
            <p className="mt-1">
              {e.type === 'CREATED' ? 'Reported the repair.' : e.type === 'STATUS' ? `Status: ${e.fromStatus ? `${REPAIR_STATUS_LABELS[e.fromStatus]} → ` : ''}${REPAIR_STATUS_LABELS[e.toStatus!]}.` : null}
              {e.body ? <span className="block whitespace-pre-wrap">{e.body}</span> : null}
            </p>
          </li>
        ))}
      </ol>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          if (await run(`/repairs/${r.id}/comments`, 'POST', { body, visibility: internal ? 'INTERNAL' : 'TENANT' }, internal ? 'Internal note added' : 'Comment shared with the tenant')) setBody('');
        }}
      >
        <Textarea aria-label="New comment" rows={3} placeholder={internal ? 'Internal note for your team…' : 'Update for the tenant…'} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={internal} onCheckedChange={setInternal} /> Internal only
          </label>
          <Button size="sm" type="submit" disabled={pending || !body.trim()}>
            <MessageSquare className="size-4" /> {internal ? 'Add internal note' : 'Share with tenant'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Manage({ r, set }: { r: RepairDetail; set: (r: RepairDetail) => void }) {
  const { data: contractors } = useApi<ContractorItem[]>('/contractors');
  const [status, setStatus] = useState<RepairStatus>(r.status);
  const [note, setNote] = useState('');
  const [contractorId, setContractorId] = useState(r.contractorId ?? '');
  const [cost, setCost] = useState(r.costPence !== null ? penceToInput(r.costPence) : '');
  const { pending, run } = useAction(set);
  return (
    <div className="space-y-6">
      <Section title="Status">
        <div className="space-y-3">
          <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as RepairStatus)}>
            {REPAIR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REPAIR_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
          <Textarea aria-label="Note for the tenant" rows={2} placeholder="Optional note for the tenant" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            className="w-full"
            disabled={pending || status === r.status}
            onClick={async () => {
              if (await run(`/repairs/${r.id}/status`, 'POST', { status, note: note || null }, `Marked as ${REPAIR_STATUS_LABELS[status].toLowerCase()}. The tenant has been emailed.`)) setNote('');
            }}
          >
            Update status
          </Button>
        </div>
      </Section>
      <Section title="Priority">
        <NativeSelect aria-label="Priority" value={r.priority} onChange={(e) => void run(`/repairs/${r.id}`, 'PATCH', { priority: e.target.value as RepairPriority }, 'Priority changed')}>
          {REPAIR_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {REPAIR_PRIORITY_LABELS[p]}
            </option>
          ))}
        </NativeSelect>
        <p className={cn('mt-2 text-sm', r.overdue ? 'font-semibold text-bad' : 'text-muted-foreground')}>
          {r.overdue ? 'Past its target of ' : 'Target: '}
          {formatDateTime(r.targetAt)}
        </p>
      </Section>
      <Section title="Contractor">
        <div className="space-y-3">
          <NativeSelect aria-label="Contractor" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            <option value="">Choose a contractor</option>
            {(contractors ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.trade})
              </option>
            ))}
          </NativeSelect>
          <Button className="w-full" variant="outline" disabled={pending || !contractorId} onClick={() => void run(`/repairs/${r.id}/assign`, 'POST', { contractorId }, 'Job link emailed to the contractor')}>
            <Send className="size-4" /> {r.contractorId === contractorId && r.link ? 'Send a new link' : 'Assign and send link'}
          </Button>
          {contractors && !contractors.length ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/app/contractors" className="text-door hover:underline">
                Add a contractor
              </Link>{' '}
              first.
            </p>
          ) : null}
          {r.link ? (
            <div className="rounded-md bg-stone px-3 py-2 text-sm">
              <p>{r.link.active ? 'The job link works.' : 'The job link has expired.'}</p>
              <p className="text-muted-foreground">{r.link.lastUsedAt ? `Last opened ${formatDateTime(r.link.lastUsedAt)}` : 'Not opened yet'}</p>
              {r.link.active ? (
                <Confirm title="Withdraw the job link?" description="The contractor won’t be able to open or update this job any more." confirmLabel="Withdraw link" destructive onConfirm={() => run(`/repairs/${r.id}/links/revoke`, 'POST', {}, 'Link withdrawn')}>
                  <button className="mt-1 inline-flex items-center gap-1 font-semibold text-bad hover:underline">
                    <Link2Off className="size-3.5" /> Withdraw link
                  </button>
                </Confirm>
              ) : null}
            </div>
          ) : null}
        </div>
      </Section>
      <Section title="Cost" description="Recorded for the maintenance report.">
        <div className="flex gap-2">
          <MoneyInput aria-label="Cost" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Button variant="outline" disabled={pending} onClick={() => void run(`/repairs/${r.id}`, 'PATCH', { costPence: cost ? (parsePounds(cost) ?? 0) : null }, 'Cost saved')}>
            Save
          </Button>
        </div>
      </Section>
    </div>
  );
}

export default function RepairPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error, loading, reload, setData } = useApi<RepairDetail>(`/repairs/${id}`);
  if (loading && !r) return <ListSkeleton rows={6} />;
  if (error || !r) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        back={{ href: '/app/repairs', label: 'Repairs' }}
        title={
          <>
            <span className="text-muted-foreground">#{r.reference}</span> {r.title}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/app/properties/${r.propertyId}`} className="hover:text-door hover:underline">
              {r.unitName ? `${r.unitName}, ` : ''}
              {r.address}
            </Link>
            <StatusBadge tone={REPAIR_STATUS_TONE[r.status]}>{REPAIR_STATUS_LABELS[r.status]}</StatusBadge>
            <StatusBadge tone={PRIORITY_TONE[r.priority]}>{REPAIR_PRIORITY_LABELS[r.priority]}</StatusBadge>
            {r.overdue ? (
              <StatusBadge tone="bad">
                <AlarmClock className="size-3" aria-hidden /> Past target
              </StatusBadge>
            ) : null}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Section title="Details">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">{REPAIR_CATEGORY_LABELS[r.category]}</dt>
                <dd className="mt-1 whitespace-pre-wrap">{r.description}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Access notes</dt>
                <dd className="whitespace-pre-wrap">{r.accessNotes ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Tenant availability</dt>
                <dd className="whitespace-pre-wrap">{r.availability ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Reported</dt>
                <dd>
                  {formatDateTime(r.createdAt)} by {r.reportedBy === 'TENANT' ? 'the tenant' : 'your team'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Visit</dt>
                <dd>{r.visitAt ? formatDateTime(r.visitAt) : 'Not booked'}</dd>
              </div>
              {r.tenants.length ? (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Tenants</dt>
                  <dd>{r.tenants.map((t) => [t.name, t.phone].filter(Boolean).join(', ')).join('; ')}</dd>
                </div>
              ) : null}
              {r.costPence !== null ? (
                <div>
                  <dt className="text-sm text-muted-foreground">Cost</dt>
                  <dd className="font-semibold">{formatPence(r.costPence)}</dd>
                </div>
              ) : null}
            </dl>
          </Section>
          <Photos r={r} reload={reload} />
          <Activity r={r} set={setData} />
        </div>
        <Manage key={`${r.status}-${r.contractorId}`} r={r} set={setData} />
      </div>
    </>
  );
}
