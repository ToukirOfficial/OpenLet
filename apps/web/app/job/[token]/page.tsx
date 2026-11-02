'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CalendarClock, Camera, CheckCircle2, KeyRound, MapPin, Phone, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { REPAIR_CATEGORY_LABELS, REPAIR_PRIORITY_LABELS, REPAIR_STATUS_LABELS, formatDateTime, formatPence, parsePounds, penceToInput, type ContractorJob } from '@openlet/shared';
import { LogoMark } from '@/components/brand';
import { MoneyInput } from '@/components/money-input';
import { ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api, apiUrl, errorMessage } from '@/lib/api';
import { PRIORITY_TONE, REPAIR_STATUS_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';

/** datetime-local value in the phone's own time (UK contractors, UK phones). */
const localInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** The contractor's job page: one screen, works on any phone, no login. */
export default function JobPage() {
  const { token } = useParams<{ token: string }>();
  const { data: job, error, loading, setData } = useApi<ContractorJob>(`/job/${token}`);
  const [visit, setVisit] = useState<string | null>(null);
  const [cost, setCost] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      setData(await api<ContractorJob>(`/job/${token}`, { method: 'POST', body }));
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function photo(file: File) {
    const body = new FormData();
    body.append('file', file);
    setBusy(true);
    try {
      setData(await api<ContractorJob>(`/job/${token}/photos`, { method: 'POST', body }));
      toast.success('Photo added');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !job) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }
  if (error || !job) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-10">
        <LogoMark className="h-9" />
        <h1 className="text-title font-bold">This job link isn’t working</h1>
        <ErrorState error={error} />
      </main>
    );
  }

  const visitValue = visit ?? localInput(job.visitAt);
  const costValue = cost ?? (job.costPence !== null ? penceToInput(job.costPence) : '');
  const open = ['REPORTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS'].includes(job.status);

  return (
    <div className="min-h-dvh pb-10">
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <LogoMark className="h-8" />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{job.workspaceName}</p>
            <p className="text-xs text-muted-foreground">Job #{job.reference}</p>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-lg space-y-4 px-4 py-5">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={REPAIR_STATUS_TONE[job.status]}>{REPAIR_STATUS_LABELS[job.status]}</StatusBadge>
            <StatusBadge tone={PRIORITY_TONE[job.priority]}>{REPAIR_PRIORITY_LABELS[job.priority]}</StatusBadge>
          </div>
          <h1 className="text-title font-bold">{job.title}</h1>
          <p className="text-sm text-muted-foreground">{REPAIR_CATEGORY_LABELS[job.category]}</p>
        </div>

        <section className="space-y-3 rounded-lg border border-border bg-paper p-4">
          <p className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-door" aria-hidden />
            <span>
              {job.unitName ? `${job.unitName}, ` : ''}
              {job.address}
            </span>
          </p>
          {job.accessNotes ? (
            <p className="flex gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-door" aria-hidden />
              <span className="whitespace-pre-wrap">{job.accessNotes}</span>
            </p>
          ) : null}
          {job.tenant ? (
            <p className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-door" aria-hidden />
              <span>
                {job.tenant.names}
                {job.tenant.phone ? (
                  <>
                    {' '}
                    <a className="font-semibold text-door underline" href={`tel:${job.tenant.phone}`}>
                      {job.tenant.phone}
                    </a>
                  </>
                ) : null}
              </span>
            </p>
          ) : job.workspaceContact ? (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <Phone className="mt-0.5 size-4 shrink-0" aria-hidden /> Arrange access through {job.workspaceName}: {job.workspaceContact}
            </p>
          ) : null}
          <div className="border-t border-border pt-3">
            <p className="whitespace-pre-wrap">{job.description}</p>
            {job.availability ? <p className="mt-2 text-sm text-muted-foreground">Tenant availability: {job.availability}</p> : null}
          </div>
        </section>

        {job.canUpdate ? (
          <section className="space-y-4 rounded-lg border border-border bg-paper p-4">
            <h2 className="font-semibold">Update the job</h2>
            <div className="space-y-2">
              <label htmlFor="visit" className="text-sm font-medium">
                Visit date and time
              </label>
              <div className="flex gap-2">
                <Input id="visit" type="datetime-local" className="h-12" value={visitValue} onChange={(e) => setVisit(e.target.value)} />
                <Button
                  size="lg"
                  variant="outline"
                  disabled={busy || !visitValue}
                  onClick={() => void send({ visitAt: new Date(visitValue).toISOString(), ...(open && job.status !== 'IN_PROGRESS' ? { status: 'SCHEDULED' } : {}) }, 'Visit booked. The tenant has been told.')}
                >
                  <CalendarClock className="size-4" /> Book
                </Button>
              </div>
            </div>
            {open ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button size="lg" variant="outline" className="h-12" disabled={busy || job.status === 'IN_PROGRESS'} onClick={() => void send({ status: 'IN_PROGRESS' }, 'Marked as in progress')}>
                  <PlayCircle className="size-4" /> Started work
                </Button>
                <Button size="lg" className="h-12" disabled={busy} onClick={() => void send({ status: 'COMPLETED', ...(costValue ? { costPence: parsePounds(costValue) ?? 0 } : {}) }, 'Marked as completed. Thank you!')}>
                  <CheckCircle2 className="size-4" /> Job done
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="cost" className="text-sm font-medium">
                Cost (for the landlord)
              </label>
              <div className="flex gap-2">
                <MoneyInput id="cost" className="h-12" value={costValue} onChange={(e) => setCost(e.target.value)} />
                <Button size="lg" variant="outline" disabled={busy || !costValue} onClick={() => void send({ costPence: parsePounds(costValue) ?? 0 }, 'Cost saved')}>
                  Save
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="note" className="text-sm font-medium">
                Note
              </label>
              <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you found or did. The tenant and landlord see this." />
              <Button
                variant="outline"
                disabled={busy || !note.trim()}
                onClick={async () => {
                  if (await send({ note }, 'Note added')) setNote('');
                }}
              >
                Add note
              </Button>
            </div>
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong font-semibold text-door hover:bg-door-tint/40">
              <Camera className="size-5" aria-hidden /> Add a photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && void photo(e.target.files[0])} />
            </label>
          </section>
        ) : (
          <p className="rounded-lg border border-border bg-paper p-4 text-sm text-muted-foreground">This job is {REPAIR_STATUS_LABELS[job.status].toLowerCase()}. Contact {job.workspaceName} if something needs changing.</p>
        )}

        {job.photos.length ? (
          <section className="space-y-2">
            <h2 className="font-semibold">Photos</h2>
            <ul className="grid grid-cols-3 gap-2">
              {job.photos.map((p) => (
                <li key={p.id} className="aspect-square overflow-hidden rounded-md bg-stone-deep">
                  {p.ready ? <img src={apiUrl(`/job/${token}/photos/${p.id}`)} alt="Job photo" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs">Processing…</span>}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {job.updates.length ? (
          <section className="space-y-2">
            <h2 className="font-semibold">History</h2>
            <ol className="space-y-2 text-sm">
              {[...job.updates].reverse().map((u, i) => (
                <li key={i} className="rounded-md bg-paper px-3 py-2">
                  <span className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</span>
                  <p>{u.type === 'STATUS' && u.toStatus ? `Status: ${REPAIR_STATUS_LABELS[u.toStatus]}.` : u.type === 'CREATED' ? 'Reported.' : null} {u.body}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {job.costPence !== null ? <p className="text-sm text-muted-foreground">Cost recorded: {formatPence(job.costPence)}</p> : null}
        <p className="pt-4 text-center text-xs text-muted-foreground">Please don’t share this link. It only opens this one job.</p>
      </main>
    </div>
  );
}
