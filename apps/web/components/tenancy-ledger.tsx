'use client';

import { useState } from 'react';
import { MinusCircle, PlusCircle, PoundSterling, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, formatDate, formatPence, londonDate, otherChargeSchema, parsePounds, paymentSchema, type Ledger, type LedgerRow, type PaymentMethod, type TenancyDetail } from '@openlet/shared';
import { Balance } from '@/components/balance';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { LedgerTable } from '@/components/ledger-table';
import { MoneyInput } from '@/components/money-input';
import { Section } from '@/components/section';
import { StatementButton } from '@/components/statement-button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';

function PaymentForm({ tenancyId, suggested, onDone }: { tenancyId: string; suggested: number; onDone: (l: Ledger) => void }) {
  const [v, setV] = useState({ date: londonDate(), amount: suggested > 0 ? (suggested / 100).toFixed(2) : '', method: 'BANK_TRANSFER' as PaymentMethod, reference: '' });
  const form = useForm(paymentSchema);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const l = await form.submit<Ledger>({ tenancyId, date: v.date, amountPence: parsePounds(v.amount) ?? 0, method: v.method, reference: v.reference || null }, '/payments');
        if (l) onDone(l);
      }}
    >
      <FormError message={form.formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" hint="Part-payments and overpayments are fine." error={form.errors['amountPence']}>
          {(p) => <MoneyInput {...p} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} autoFocus />}
        </Field>
        <Field label="Date received" error={form.errors['date']}>
          {(p) => <Input {...p} type="date" max={londonDate()} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}
        </Field>
        <Field label="Method">
          {(p) => (
            <NativeSelect {...p} value={v.method} onChange={(e) => setV({ ...v, method: e.target.value as PaymentMethod })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Reference" optional>
          {(p) => <Input {...p} value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} />}
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">Payments go to the oldest unpaid charges first. Anything extra is kept as credit.</p>
      <Button type="submit" disabled={form.pending}>
        {form.pending ? 'Saving…' : 'Record payment'}
      </Button>
    </form>
  );
}

function ChargeForm({ tenancyId, kind, onDone }: { tenancyId: string; kind: 'charges' | 'credits'; onDone: (l: Ledger) => void }) {
  const [v, setV] = useState({ date: londonDate(), amount: '', description: '' });
  const form = useForm(otherChargeSchema);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const l = await form.submit<Ledger>({ tenancyId, date: v.date, amountPence: parsePounds(v.amount) ?? 0, description: v.description }, `/${kind}`);
        if (l) onDone(l);
      }}
    >
      <FormError message={form.formError} />
      <Field label="Description" hint={kind === 'charges' ? 'e.g. Replacement keys' : 'e.g. Goodwill for a delayed repair'} error={form.errors['description']}>
        {(p) => <Input {...p} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} autoFocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" error={form.errors['amountPence']}>
          {(p) => <MoneyInput {...p} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />}
        </Field>
        <Field label={kind === 'charges' ? 'Due on' : 'Date'} error={form.errors['date']}>
          {(p) => <Input {...p} type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}
        </Field>
      </div>
      <Button type="submit" disabled={form.pending}>
        {kind === 'charges' ? 'Add charge' : 'Add credit'}
      </Button>
    </form>
  );
}

function ReverseButton({ row, onDone }: { row: LedgerRow; onDone: (l: Ledger) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (row.reversed || row.type === 'REVERSAL') return null;
  return (
    <FormDialog title="Reverse this entry?" description={`${row.description}, ${formatPence(row.amountPence)} on ${formatDate(row.date)}. The entry stays in the ledger with a matching reversal, so the history is never lost.`} open={open} onOpenChange={setOpen} trigger={<Button variant="ghost" size="sm" aria-label={`Reverse ${row.description}`}><Undo2 className="size-4" /></Button>}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reason.trim()) return setError('Say why, for the record.');
          try {
            onDone(await api<Ledger>(`/ledger/${row.id}/reverse`, { method: 'POST', body: { reason } }));
            setOpen(false);
            toast.success('Entry reversed');
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <FormError message={error} />
        <Field label="Reason">{(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" autoFocus />}</Field>
        <Button type="submit" className="bg-bad hover:bg-bad/90">
          Reverse entry
        </Button>
      </form>
    </FormDialog>
  );
}

export function TenancyLedger({ tenancy, onChange }: { tenancy: TenancyDetail; onChange: () => void }) {
  const { data, error, loading, reload, setData } = useApi<Ledger>(`/tenancies/${tenancy.id}/ledger`);
  const [dialog, setDialog] = useState<'payment' | 'charges' | 'credits' | null>(null);
  const done = (l: Ledger, msg: string) => {
    setData(l);
    setDialog(null);
    toast.success(msg);
    onChange();
  };
  if (loading && !data) return <ListSkeleton rows={6} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <Section
      title={
        <span className="flex flex-wrap items-baseline gap-x-3">
          Rent ledger <Balance pence={data.balancePence} className="text-base" />
        </span>
      }
      description={data.arrearsPence > 0 ? `${formatPence(data.arrearsPence)} overdue, oldest by ${data.daysOverdue} days.` : data.nextDueDate ? `Next rent due ${formatDate(data.nextDueDate)}.` : undefined}
      flush
      actions={
        <>
          <FormDialog title="Record a payment" open={dialog === 'payment'} onOpenChange={(o) => setDialog(o ? 'payment' : null)} wide trigger={<Button size="sm"><PoundSterling className="size-4" /> Record payment</Button>}>
            <PaymentForm tenancyId={tenancy.id} suggested={Math.max(0, data.balancePence)} onDone={(l) => done(l, 'Payment recorded')} />
          </FormDialog>
          <FormDialog title="Add a one-off charge" open={dialog === 'charges'} onOpenChange={(o) => setDialog(o ? 'charges' : null)} trigger={<Button size="sm" variant="outline"><PlusCircle className="size-4" /> Charge</Button>}>
            <ChargeForm tenancyId={tenancy.id} kind="charges" onDone={(l) => done(l, 'Charge added')} />
          </FormDialog>
          <FormDialog title="Add a credit" open={dialog === 'credits'} onOpenChange={(o) => setDialog(o ? 'credits' : null)} trigger={<Button size="sm" variant="outline"><MinusCircle className="size-4" /> Credit</Button>}>
            <ChargeForm tenancyId={tenancy.id} kind="credits" onDone={(l) => done(l, 'Credit added')} />
          </FormDialog>
          <StatementButton path={`/tenancies/${tenancy.id}/statements`} jobsBase="/jobs" size="sm" />
        </>
      }
    >
      {!data.rows.length ? (
        <div className="p-5">
          <EmptyState icon={PoundSterling} title="No charges yet">
            Rent charges appear by themselves up to two weeks before each due date.
          </EmptyState>
        </div>
      ) : (
        <LedgerTable rows={data.rows} action={(r) => <ReverseButton row={r} onDone={(l) => done(l, 'Entry reversed')} />} />
      )}
    </Section>
  );
}
