'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AlertTriangle, CalendarClock, DoorOpen, Pencil, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEPOSIT_SCHEMES,
  DEPOSIT_SCHEME_LABELS,
  FREQUENCY_LABELS,
  FREQUENCY_SHORT,
  TENANCY_STATUS_LABELS,
  depositSchema,
  formatDate,
  formatPence,
  guarantorSchema,
  londonDate,
  noticeSchema,
  parsePounds,
  penceToInput,
  rentChangeSchema,
  tenancyUpdateSchema,
  type DepositScheme,
  type GuarantorItem,
  type TenancyDetail,
} from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Balance } from '@/components/balance';
import { Confirm } from '@/components/confirm';
import { DocumentsPanel } from '@/components/documents-panel';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { MoneyInput } from '@/components/money-input';
import { NotesPanel } from '@/components/notes-panel';
import { RecordTabs } from '@/components/record-tabs';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { TenancyLedger, TenancyMessages, TenancyRepairs } from '@/components/tenancy-extras';
import { TenantPortalInvite } from '@/components/tenant-invite';
import { Timeline } from '@/components/timeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { PORTAL_LABEL, TENANCY_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';

type Props = { t: TenancyDetail; set: (t: TenancyDetail) => void; reload: () => void };

function Stat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'bad' }) {
  return (
    <div className={`rounded-lg border bg-paper px-4 py-3 ${tone === 'bad' ? 'border-bad/30' : 'border-border'}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{children}</p>
    </div>
  );
}

function ChangeRent({ t, set }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(penceToInput(t.rentPence));
  const [from, setFrom] = useState(t.nextDueDate ?? londonDate());
  const form = useForm(rentChangeSchema);
  return (
    <FormDialog title="Change the rent" description="Charges from this date use the new amount. Earlier charges stay as they are." open={open} onOpenChange={setOpen} trigger={<Button size="sm" variant="outline"><Pencil className="size-3.5" /> Change rent</Button>}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await form.submit<TenancyDetail>({ amountPence: parsePounds(amount) ?? 0, effectiveFrom: from }, `/tenancies/${t.id}/rent-changes`);
          if (saved) {
            set(saved);
            setOpen(false);
            toast.success('Rent change saved');
          }
        }}
      >
        <FormError message={form.formError} />
        <Field label="New rent" error={form.errors['amountPence']}>
          {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="From" hint="Usually a due date. It applies to every rent period starting on or after it." error={form.errors['effectiveFrom']}>
          {(p) => <Input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}
        </Field>
        <Button type="submit" disabled={form.pending}>
          Save rent change
        </Button>
      </form>
    </FormDialog>
  );
}

function NoticeAndEnd({ t, set }: Props) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [n, setN] = useState({ givenBy: 'TENANT' as 'TENANT' | 'LANDLORD', givenOn: londonDate(), endDate: t.endDate ?? '' });
  const [endedOn, setEndedOn] = useState(t.noticeEndDate ?? t.endDate ?? londonDate());
  const notice = useForm(noticeSchema);
  const [endError, setEndError] = useState<string | null>(null);

  if (t.status === 'ENDED') {
    return (
      <Section title="Tenancy ended">
        <p>This tenancy ended on {formatDate(t.endedOn ?? t.endDate)}.</p>
        {t.deposit && !t.deposit.returnedOn ? <p className="mt-2 text-sm text-muted-foreground">Record the deposit return on the Deposit tab.</p> : null}
      </Section>
    );
  }

  return (
    <Section title="Notice and ending" description="Recording notice marks the tenancy as ending. No rent is charged after the last day.">
      {t.noticeEndDate ? (
        <div className="mb-4 rounded-md border border-warn/30 bg-warn-tint px-4 py-3 text-sm">
          Notice given by the {t.noticeBy === 'TENANT' ? 'tenant' : 'landlord'} on {formatDate(t.noticeGivenOn)}. The tenancy ends on <strong>{formatDate(t.noticeEndDate)}</strong>.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!t.noticeEndDate ? (
          <FormDialog title="Record notice" open={noticeOpen} onOpenChange={setNoticeOpen} trigger={<Button variant="outline"><CalendarClock className="size-4" /> Record notice</Button>}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                const saved = await notice.submit<TenancyDetail>(n, `/tenancies/${t.id}/notice`);
                if (saved) {
                  set(saved);
                  setNoticeOpen(false);
                  toast.success('Notice recorded');
                }
              }}
            >
              <FormError message={notice.formError} />
              <Field label="Given by">
                {(p) => (
                  <NativeSelect {...p} value={n.givenBy} onChange={(e) => setN({ ...n, givenBy: e.target.value as 'TENANT' | 'LANDLORD' })}>
                    <option value="TENANT">The tenant</option>
                    <option value="LANDLORD">The landlord</option>
                  </NativeSelect>
                )}
              </Field>
              <Field label="Notice given on" error={notice.errors['givenOn']}>
                {(p) => <Input {...p} type="date" value={n.givenOn} onChange={(e) => setN({ ...n, givenOn: e.target.value })} />}
              </Field>
              <Field label="Tenancy ends on" hint="The last day the tenants are responsible for." error={notice.errors['endDate']}>
                {(p) => <Input {...p} type="date" value={n.endDate} onChange={(e) => setN({ ...n, endDate: e.target.value })} />}
              </Field>
              <Button type="submit" disabled={notice.pending}>
                Save notice
              </Button>
            </form>
          </FormDialog>
        ) : (
          <Confirm
            title="Withdraw the notice?"
            description="The tenancy goes back to active, with its original end date."
            confirmLabel="Withdraw notice"
            onConfirm={async () => {
              set(await api<TenancyDetail>(`/tenancies/${t.id}/notice`, { method: 'DELETE' }));
              toast.success('Notice withdrawn');
            }}
          >
            <Button variant="ghost">Withdraw notice</Button>
          </Confirm>
        )}
        <FormDialog title="End the tenancy" description="Any rent charged for periods after this date is reversed in the ledger." open={endOpen} onOpenChange={setEndOpen} trigger={<Button variant="outline"><DoorOpen className="size-4" /> End tenancy</Button>}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setEndError(null);
              try {
                set(await api<TenancyDetail>(`/tenancies/${t.id}/end`, { method: 'POST', body: { endedOn } }));
                setEndOpen(false);
                toast.success('Tenancy ended');
              } catch (err) {
                setEndError(errorMessage(err));
              }
            }}
          >
            <FormError message={endError} />
            <Field label="Last day of the tenancy">{(p) => <Input {...p} type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} />}</Field>
            <Button type="submit">End tenancy</Button>
          </form>
        </FormDialog>
      </div>
    </Section>
  );
}

function GuarantorForm({ t, g, onDone }: { t: TenancyDetail; g?: GuarantorItem; onDone: (t: TenancyDetail) => void }) {
  const [v, setV] = useState({ name: g?.name ?? '', email: g?.email ?? '', phone: g?.phone ?? '', address: g?.address ?? '', notes: g?.notes ?? '' });
  const form = useForm(guarantorSchema);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const saved = await form.submit<TenancyDetail>(v, g ? `/tenancies/${t.id}/guarantors/${g.id}` : `/tenancies/${t.id}/guarantors`, { method: g ? 'PATCH' : 'POST' });
        if (saved) onDone(saved);
      }}
    >
      <FormError message={form.formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={form.errors['name']}>
          {(p) => <Input {...p} value={v.name} onChange={set('name')} />}
        </Field>
        <Field label="Email" optional error={form.errors['email']}>
          {(p) => <Input {...p} type="email" value={v.email} onChange={set('email')} />}
        </Field>
        <Field label="Phone" optional error={form.errors['phone']}>
          {(p) => <Input {...p} type="tel" value={v.phone} onChange={set('phone')} />}
        </Field>
        <Field label="Address" optional>
          {(p) => <Input {...p} value={v.address} onChange={set('address')} />}
        </Field>
      </div>
      <Field label="Notes" optional>
        {(p) => <Textarea {...p} rows={2} value={v.notes} onChange={set('notes')} />}
      </Field>
      <Button type="submit" disabled={form.pending}>
        {g ? 'Save' : 'Add guarantor'}
      </Button>
    </form>
  );
}

function Guarantors({ t, set }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Section
      title="Guarantors"
      actions={
        <FormDialog title="Add a guarantor" open={open} onOpenChange={setOpen} wide trigger={<Button size="sm" variant="outline"><Plus className="size-4" /> Add guarantor</Button>}>
          <GuarantorForm
            t={t}
            onDone={(saved) => {
              set(saved);
              setOpen(false);
            }}
          />
        </FormDialog>
      }
    >
      {!t.guarantors.length ? (
        <p className="text-sm text-muted-foreground">No guarantor. Add one if someone guarantees the rent. Upload their agreement on the Documents tab.</p>
      ) : (
        <ul className="divide-y divide-border">
          {t.guarantors.map((g) => (
            <li key={g.id} className="flex items-start gap-3 py-3">
              <div className="flex-1 text-sm">
                <p className="font-semibold">{g.name}</p>
                <p className="text-muted-foreground">{[g.email, g.phone, g.address].filter(Boolean).join(' · ') || 'No contact details'}</p>
                {g.notes ? <p className="mt-1">{g.notes}</p> : null}
              </div>
              <Button variant="ghost" size="sm" aria-label={`Remove ${g.name}`} onClick={async () => set(await api<TenancyDetail>(`/tenancies/${t.id}/guarantors/${g.id}`, { method: 'DELETE' }))}>
                <Trash2 className="size-4 text-bad" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function TenancySettings({ t, set }: Props) {
  const [endDate, setEndDate] = useState(t.endDate && !t.noticeEndDate ? t.endDate : '');
  const form = useForm(tenancyUpdateSchema);
  if (t.status === 'ENDED') return null;
  return (
    <Section title="Terms">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await form.submit<TenancyDetail>({ endDate: endDate || null }, `/tenancies/${t.id}`, { method: 'PATCH' });
          if (saved) {
            set(saved);
            toast.success('Saved');
          }
        }}
      >
        <FormError message={form.formError} />
        <Field label="Fixed term ends on" hint="Leave empty for a rolling (periodic) tenancy." error={form.errors['endDate']}>
          {(p) => (
            <div className="flex gap-2">
              <Input {...p} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="max-w-48" />
              <Button type="submit" variant="outline" disabled={form.pending}>
                Save
              </Button>
            </div>
          )}
        </Field>
      </form>
      <label className="mt-4 flex items-start gap-3">
        <Switch
          checked={t.remindersEnabled}
          onCheckedChange={async (c) => {
            try {
              set(await api<TenancyDetail>(`/tenancies/${t.id}`, { method: 'PATCH', body: { remindersEnabled: c } }));
              toast.success(c ? 'Rent reminders on' : 'Rent reminders off');
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
        <span>
          <span className="block font-medium">Rent reminder emails</span>
          <span className="block text-sm text-muted-foreground">Before rent is due and when it’s late. They stop once it’s paid.</span>
        </span>
      </label>
    </Section>
  );
}

function Overview(props: Props) {
  const { t, reload } = props;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Section title="Tenants">
          <ul className="divide-y divide-border">
            {t.tenants.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                <UserRound className="size-5 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link href={`/app/tenants/${x.id}`} className="font-semibold hover:text-door">
                    {x.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{[x.email, x.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
                </div>
                <StatusBadge tone={PORTAL_LABEL[x.portal][1]}>{PORTAL_LABEL[x.portal][0]}</StatusBadge>
                <TenantPortalInvite tenant={x} onChange={reload} size="sm" />
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Rent" actions={t.status !== 'ENDED' ? <ChangeRent {...props} /> : null}>
          <p className="mb-3">
            {formatPence(t.rentPence)} {FREQUENCY_LABELS[t.frequency].toLowerCase()}
            {t.frequency === 'MONTHLY' ? `, due on day ${t.dueDay} of the month` : ', counted from the start date'}.
          </p>
          <ol className="space-y-1.5 text-sm">
            {t.rentChanges.map((r, i) => (
              <li key={r.id} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
                <span>{i === 0 ? `From the start, ${formatDate(r.effectiveFrom)}` : `From ${formatDate(r.effectiveFrom)}`}</span>
                <span className="font-semibold tabular-nums">{formatPence(r.amountPence)}</span>
              </li>
            ))}
          </ol>
        </Section>
        <Guarantors {...props} />
      </div>
      <div className="space-y-6">
        <NoticeAndEnd {...props} />
        <TenancySettings {...props} />
      </div>
    </div>
  );
}

function Deposit({ t, set }: Props) {
  const d = t.deposit;
  const [v, setV] = useState({
    amount: d ? penceToInput(d.amountPence) : '',
    receivedOn: d?.receivedOn ?? '',
    scheme: (d?.scheme ?? '') as DepositScheme | '',
    schemeReference: d?.schemeReference ?? '',
    protectedOn: d?.protectedOn ?? '',
    prescribedInfoOn: d?.prescribedInfoOn ?? '',
  });
  const [deductions, setDeductions] = useState<{ reason: string; amount: string }[]>(d?.deductions.map((x) => ({ reason: x.reason, amount: penceToInput(x.amountPence) })) ?? []);
  const [returnedOn, setReturnedOn] = useState(d?.returnedOn ?? londonDate());
  const form = useForm(depositSchema);
  const [returnError, setReturnError] = useState<string | null>(null);
  const deducted = deductions.reduce((s, x) => s + (parsePounds(x.amount) ?? 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Deposit protection" description="In England, a deposit must be protected in a government scheme and the prescribed information given within 30 days of receiving it.">
        {d?.protectionOverdue ? (
          <div role="alert" className="mb-4 flex gap-2 rounded-md border border-bad/25 bg-bad-tint px-3 py-2 text-sm text-bad">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Not marked as protected. It should have been protected by {formatDate(d.protectBy)}.
          </div>
        ) : d?.protectedOn ? (
          <div className="mb-4 flex gap-2 rounded-md border border-ok/25 bg-ok-tint px-3 py-2 text-sm text-ok">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Protected on {formatDate(d.protectedOn)}.
          </div>
        ) : null}
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await form.submit<TenancyDetail>(
              { amountPence: parsePounds(v.amount) ?? 0, receivedOn: v.receivedOn || null, scheme: v.scheme || null, schemeReference: v.schemeReference || null, protectedOn: v.protectedOn || null, prescribedInfoOn: v.prescribedInfoOn || null },
              `/tenancies/${t.id}/deposit`,
              { method: 'PUT' },
            );
            if (saved) {
              set(saved);
              toast.success('Deposit saved');
            }
          }}
        >
          <FormError message={form.formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" error={form.errors['amountPence']}>
              {(p) => <MoneyInput {...p} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />}
            </Field>
            <Field label="Received on" optional>
              {(p) => <Input {...p} type="date" value={v.receivedOn} onChange={(e) => setV({ ...v, receivedOn: e.target.value })} />}
            </Field>
            <Field label="Scheme" optional>
              {(p) => (
                <NativeSelect {...p} value={v.scheme} onChange={(e) => setV({ ...v, scheme: e.target.value as DepositScheme })}>
                  <option value="">Not protected yet</option>
                  {DEPOSIT_SCHEMES.map((s) => (
                    <option key={s} value={s}>
                      {DEPOSIT_SCHEME_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Scheme reference" optional>
              {(p) => <Input {...p} value={v.schemeReference} onChange={(e) => setV({ ...v, schemeReference: e.target.value })} />}
            </Field>
            <Field label="Protected on" optional>
              {(p) => <Input {...p} type="date" value={v.protectedOn} onChange={(e) => setV({ ...v, protectedOn: e.target.value })} />}
            </Field>
            <Field label="Prescribed information given on" optional>
              {(p) => <Input {...p} type="date" value={v.prescribedInfoOn} onChange={(e) => setV({ ...v, prescribedInfoOn: e.target.value })} />}
            </Field>
          </div>
          <Button type="submit" disabled={form.pending}>
            Save deposit
          </Button>
        </form>
      </Section>
      {d ? (
        <Section title="Deposit return" description="At the end of the tenancy, record any deductions and the amount returned.">
          {d.returnedOn ? (
            <p className="mb-4 rounded-md bg-stone px-3 py-2 text-sm">
              Returned {formatPence(d.returnedPence)} on {formatDate(d.returnedOn)}.
            </p>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setReturnError(null);
              const list = deductions.filter((x) => x.reason.trim() || x.amount.trim()).map((x) => ({ reason: x.reason, amountPence: parsePounds(x.amount) ?? 0 }));
              if (list.some((x) => !x.reason.trim() || !x.amountPence)) return setReturnError('Each deduction needs a reason and an amount.');
              try {
                set(await api<TenancyDetail>(`/tenancies/${t.id}/deposit/return`, { method: 'POST', body: { returnedOn, deductions: list } }));
                toast.success('Deposit return recorded');
              } catch (err) {
                setReturnError(errorMessage(err));
              }
            }}
          >
            <FormError message={returnError} />
            {deductions.map((x, i) => (
              <div key={i} className="flex gap-2">
                <Input aria-label="Reason" placeholder="Reason, e.g. cleaning" value={x.reason} onChange={(e) => setDeductions((l) => l.map((y, j) => (j === i ? { ...y, reason: e.target.value } : y)))} />
                <div className="w-36 shrink-0">
                  <MoneyInput aria-label="Amount" value={x.amount} onChange={(e) => setDeductions((l) => l.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove deduction" onClick={() => setDeductions((l) => l.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setDeductions((l) => [...l, { reason: '', amount: '' }])}>
              <Plus className="size-4" /> Add deduction
            </Button>
            <div className="rounded-md bg-stone px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span>Deposit</span>
                <span className="tabular-nums">{formatPence(d.amountPence)}</span>
              </div>
              <div className="flex justify-between">
                <span>Deductions</span>
                <span className="tabular-nums">−{formatPence(deducted)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
                <span>To return</span>
                <span className="tabular-nums">{formatPence(Math.max(0, d.amountPence - deducted))}</span>
              </div>
            </div>
            <Field label="Returned on">{(p) => <Input {...p} type="date" value={returnedOn} onChange={(e) => setReturnedOn(e.target.value)} className="max-w-48" />}</Field>
            <Button type="submit">Record deposit return</Button>
          </form>
        </Section>
      ) : null}
    </div>
  );
}

function TenancyPage() {
  const { id } = useParams<{ id: string }>();
  const { data: t, error, loading, reload, setData } = useApi<TenancyDetail>(`/tenancies/${id}`);
  if (loading && !t) return <ListSkeleton rows={6} />;
  if (error || !t) return <ErrorState error={error} onRetry={reload} />;
  const props: Props = { t, set: setData, reload };
  return (
    <>
      <PageHeader
        back={{ href: '/app/tenancies', label: 'Tenancies' }}
        title={t.tenantNames}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/app/properties/${t.propertyId}`} className="hover:text-door hover:underline">
              {t.address}
            </Link>
            <StatusBadge tone={TENANCY_TONE[t.status]}>{TENANCY_STATUS_LABELS[t.status]}</StatusBadge>
          </span>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Rent">
          {formatPence(t.rentPence)} <span className="text-sm font-normal text-muted-foreground">{FREQUENCY_SHORT[t.frequency]}</span>
        </Stat>
        <Stat label="Balance" tone={t.arrearsPence > 0 ? 'bad' : undefined}>
          <Balance pence={t.balancePence} />
        </Stat>
        <Stat label={t.arrearsPence > 0 ? 'Overdue' : 'Next due'}>{t.arrearsPence > 0 ? `${t.daysOverdue} days` : t.nextDueDate ? formatDate(t.nextDueDate) : '—'}</Stat>
        <Stat label="Term">
          <span className="text-base">
            {formatDate(t.startDate)} – {t.endDate ? formatDate(t.endDate) : 'rolling'}
          </span>
        </Stat>
      </div>
      <RecordTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'rent', label: 'Rent ledger' },
          { id: 'deposit', label: 'Deposit' },
          { id: 'documents', label: 'Documents' },
          { id: 'repairs', label: 'Repairs' },
          { id: 'messages', label: 'Messages' },
          { id: 'notes', label: 'Notes' },
          { id: 'timeline', label: 'Timeline' },
        ]}
      >
        {(tab) =>
          tab === 'overview' ? (
            <Overview {...props} />
          ) : tab === 'rent' ? (
            <TenancyLedger tenancy={t} onChange={reload} />
          ) : tab === 'deposit' ? (
            t.deposit || t.status !== 'ENDED' ? (
              <Deposit {...props} />
            ) : (
              <EmptyState icon={ShieldCheck} title="No deposit was recorded" />
            )
          ) : tab === 'documents' ? (
            <DocumentsPanel owner={{ tenancyId: t.id }} types={['TENANCY_AGREEMENT', 'DEPOSIT_CERTIFICATE', 'PRESCRIBED_INFORMATION', 'HOW_TO_RENT', 'INVENTORY', 'OTHER', 'PHOTO']} description="The agreement, deposit paperwork and anything else for this tenancy." />
          ) : tab === 'repairs' ? (
            <TenancyRepairs tenancy={t} />
          ) : tab === 'messages' ? (
            <TenancyMessages tenancy={t} />
          ) : tab === 'notes' ? (
            <NotesPanel owner={{ tenancyId: t.id }} />
          ) : (
            <Timeline owner={{ tenancyId: t.id }} />
          )
        }
      </RecordTabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TenancyPage />
    </Suspense>
  );
}
