'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { REPAIR_CATEGORY_LABELS, REPAIR_STATUS_LABELS, formatDateTime, type PortalRepair, type RepairStatus } from '@openlet/shared';
import { ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, apiUrl, errorMessage } from '@/lib/api';
import { REPAIR_STATUS_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

const STEPS: RepairStatus[] = ['REPORTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];
const WHO = { STAFF: '', TENANT: 'You', CONTRACTOR: 'Contractor', SYSTEM: '' } as const;

function Progress({ status }: { status: RepairStatus }) {
  if (status === 'CANCELLED') return <p className="rounded-lg bg-stone-deep px-4 py-3 text-sm">This repair was cancelled.</p>;
  const at = status === 'CLOSED' ? STEPS.length : STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="space-y-1.5" aria-current={i === at ? 'step' : undefined}>
          <span className={cn('block h-2 rounded-full', i <= at ? 'bg-door' : 'bg-stone-deep')} />
          <span className={cn('block text-[0.7rem] leading-tight', i === at ? 'font-semibold text-slate' : 'text-muted-foreground')}>{REPAIR_STATUS_LABELS[s]}</span>
        </li>
      ))}
    </ol>
  );
}

function RepairView() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get('new') === '1';
  const { data: r, error, loading, reload, setData } = useApi<PortalRepair>(`/portal/repairs/${id}`);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading && !r) return <ListSkeleton rows={5} />;
  if (error || !r) return <ErrorState error={error} onRetry={reload} />;
  const open = !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(r.status);
  return (
    <div className="space-y-5">
      {isNew ? (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-ok/25 bg-ok-tint px-4 py-3 text-ok">
          <CheckCircle2 className="size-5" aria-hidden /> Thanks, your repair has been sent. We’ll email you as it moves along.
        </p>
      ) : null}
      <div className="space-y-1">
        <StatusBadge tone={REPAIR_STATUS_TONE[r.status]}>{REPAIR_STATUS_LABELS[r.status]}</StatusBadge>
        <h1 className="text-title font-bold">{r.title}</h1>
        <p className="text-sm text-muted-foreground">
          #{r.reference} · {REPAIR_CATEGORY_LABELS[r.category]} · reported {formatDateTime(r.createdAt)}
        </p>
      </div>
      <Progress status={r.status} />
      {r.visitAt && open ? <p className="rounded-lg border border-info/25 bg-info-tint px-4 py-3 font-medium text-info">Visit booked for {formatDateTime(r.visitAt)}</p> : null}
      <section className="rounded-lg border border-border bg-paper px-4 py-3">
        <p className="whitespace-pre-wrap">{r.description}</p>
        {r.accessNotes ? <p className="mt-2 text-sm text-muted-foreground">Access: {r.accessNotes}</p> : null}
        {r.availability ? <p className="text-sm text-muted-foreground">Available: {r.availability}</p> : null}
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Photos</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {r.photos.map((p) => (
            <div key={p.id} className="aspect-square overflow-hidden rounded-md bg-stone-deep">
              {p.ready ? <img src={apiUrl(`/portal/repairs/${r.id}/photos/${p.id}`)} alt="Repair photo" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs">Processing…</span>}
            </div>
          ))}
          {open ? (
            <label className={cn('grid aspect-square cursor-pointer place-items-center rounded-md border border-dashed border-line-strong text-door hover:bg-door-tint/40', busy && 'pointer-events-none opacity-60')}>
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <Camera className="size-5" aria-hidden /> Add photo
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const body = new FormData();
                  body.append('file', f);
                  setBusy(true);
                  try {
                    setData(await api<PortalRepair>(`/portal/repairs/${r.id}/photos`, { method: 'POST', body }));
                  } catch (err) {
                    toast.error(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          ) : null}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Updates</h2>
        <ol className="space-y-2">
          {[...r.events].reverse().map((e, i) => (
            <li key={i} className="rounded-lg border border-border bg-paper px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                {WHO[e.actorType] || e.actorName} · {formatDateTime(e.createdAt)}
              </p>
              <p>
                {e.type === 'STATUS' && e.toStatus ? `${REPAIR_STATUS_LABELS[e.toStatus]}.` : e.type === 'CREATED' ? 'Repair reported.' : null} {e.body}
              </p>
            </li>
          ))}
        </ol>
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            setBusy(true);
            try {
              setData(await api<PortalRepair>(`/portal/repairs/${r.id}/comments`, { method: 'POST', body: { body: comment } }));
              setComment('');
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Textarea aria-label="Add an update" rows={2} placeholder="Add an update or ask a question…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button type="submit" size="lg" disabled={busy || !comment.trim()}>
            Send update
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <RepairView />
    </Suspense>
  );
}
