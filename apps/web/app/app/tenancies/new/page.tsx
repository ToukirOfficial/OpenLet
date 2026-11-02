'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { FREQUENCY_LABELS, RENT_FREQUENCIES, formatDate, formatPence, parsePounds, tenancySchema, type Page, type PropertyOption, type RentFrequency, type TenancyDetail, type TenantDetail, type TenantListItem } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { MoneyInput } from '@/components/money-input';
import { Section } from '@/components/section';
import { ErrorState, ListSkeleton } from '@/components/states';
import { TenantForm } from '@/components/tenant-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

const STEPS = ['Property', 'Tenants', 'Rent and dates', 'Deposit', 'Check and create'] as const;

function Steps({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} className={cn('flex items-center gap-2 text-sm', i === step ? 'font-semibold text-slate' : 'text-muted-foreground')} aria-current={i === step ? 'step' : undefined}>
          <span className={cn('grid size-6 place-items-center rounded-full border text-xs', i < step ? 'border-door bg-door text-white' : i === step ? 'border-door text-door' : 'border-line-strong')}>
            {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: properties, error, reload } = useApi<PropertyOption[]>('/properties/options');
  const [q, setQ] = useState('');
  const { data: tenants, reload: reloadTenants } = useApi<Page<TenantListItem>>(`/tenants${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const [step, setStep] = useState(0);
  const [unitId, setUnitId] = useState(params.get('unitId') ?? '');
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [initialTenant] = useState(params.get('tenantId'));
  const [addingTenant, setAddingTenant] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({ startDate: today, endDate: '', rolling: false, rent: '', frequency: 'MONTHLY' as RentFrequency, dueDay: Number(today.slice(8, 10)), remindersEnabled: true, hasDeposit: true, deposit: '', depositReceivedOn: today });
  const [stepError, setStepError] = useState<string | null>(null);
  const form = useForm(tenancySchema);

  // Pre-select the tenant passed in the link (from a tenant's page).
  useEffect(() => {
    if (!initialTenant || !tenants) return;
    const t = tenants.items.find((x) => x.id === initialTenant);
    if (t) setPicked((l) => (l.length ? l : [{ id: t.id, name: t.name }]));
  }, [initialTenant, tenants]);

  const unit = useMemo(() => {
    for (const p of properties ?? []) for (const u of p.units) if (u.id === unitId) return { ...u, address: p.address };
    return null;
  }, [properties, unitId]);

  const body = () => ({
    unitId,
    tenantIds: picked.map((p) => p.id),
    startDate: v.startDate,
    endDate: v.rolling ? null : v.endDate || null,
    rentPence: parsePounds(v.rent) ?? 0,
    frequency: v.frequency,
    dueDay: v.frequency === 'MONTHLY' ? v.dueDay : Number(v.startDate.slice(8, 10)) || 1,
    remindersEnabled: v.remindersEnabled,
    deposit: v.hasDeposit && parsePounds(v.deposit) ? { amountPence: parsePounds(v.deposit)!, receivedOn: v.depositReceivedOn || null } : null,
  });

  function next() {
    setStepError(null);
    if (step === 0 && !unitId) return setStepError('Choose the property or unit being let.');
    if (step === 1 && !picked.length) return setStepError('Choose at least one tenant.');
    if (step === 2) {
      if (!parsePounds(v.rent)) return setStepError('Enter the rent, for example 850 or 850.50.');
      if (!v.rolling && !v.endDate) return setStepError('Enter the end date, or choose “Rolling”.');
      if (!v.rolling && v.endDate <= v.startDate) return setStepError('The end date must be after the start date.');
    }
    if (step === 3 && v.hasDeposit && !parsePounds(v.deposit)) return setStepError('Enter the deposit amount, or turn the deposit off.');
    setStep((s) => s + 1);
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!properties) return <ListSkeleton rows={5} />;

  return (
    <div className="max-w-3xl">
      <Steps step={step} />
      <Section>
        {step === 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Which property or unit is being let?</h2>
            {!properties.length ? <p className="text-muted-foreground">Add a property first.</p> : null}
            <div className="space-y-3">
              {properties.map((p) => (
                <fieldset key={p.id} className="rounded-md border border-border">
                  <legend className="ml-3 px-1 text-sm font-semibold">{p.address}</legend>
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {p.units.map((u) => {
                      const busy = u.tenancy && u.tenancy.status !== 'ENDED';
                      return (
                        <label key={u.id} className={cn('flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:border-line-strong', unitId === u.id && 'border-door bg-door-tint/50')}>
                          <input type="radio" name="unit" className="mt-1 accent-[var(--door)]" checked={unitId === u.id} onChange={() => setUnitId(u.id)} />
                          <span>
                            <span className="block font-medium">{u.name}</span>
                            <span className="block text-sm text-muted-foreground">
                              {busy ? `Let to ${u.tenancy!.tenantNames}${u.tenancy!.endDate ? ` until ${formatDate(u.tenancy!.endDate)}` : ''}` : 'Vacant'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Who are the tenants?</h2>
              <FormDialog title="Add a tenant" open={addingTenant} onOpenChange={setAddingTenant} wide trigger={<Button variant="outline" size="sm"><Plus className="size-4" /> New tenant</Button>}>
                <TenantForm
                  onSaved={(t: TenantDetail) => {
                    setPicked((list) => [...list, { id: t.id, name: t.name }]);
                    setAddingTenant(false);
                    void reloadTenants();
                  }}
                />
              </FormDialog>
            </div>
            <p className="text-sm text-muted-foreground">For a joint tenancy, choose everyone named on the agreement.</p>
            {picked.length ? (
              <ul className="flex flex-wrap gap-2">
                {picked.map((p) => (
                  <li key={p.id} className="flex items-center gap-1 rounded-full bg-door-tint py-1 pr-1 pl-3 text-sm font-medium text-door">
                    {p.name}
                    <button type="button" className="grid size-6 place-items-center rounded-full hover:bg-door/10" aria-label={`Remove ${p.name}`} onClick={() => setPicked((l) => l.filter((x) => x.id !== p.id))}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search tenants" placeholder="Search tenants" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {(tenants?.items ?? []).map((t) => {
                const on = picked.some((p) => p.id === t.id);
                return (
                  <li key={t.id}>
                    <button type="button" className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-stone', on && 'bg-door-tint/40')} onClick={() => setPicked((l) => (on ? l.filter((x) => x.id !== t.id) : [...l, { id: t.id, name: t.name }]))}>
                      <span className={cn('grid size-5 place-items-center rounded border', on ? 'border-door bg-door text-white' : 'border-line-strong')}>{on ? <Check className="size-3.5" /> : null}</span>
                      <span className="flex-1">
                        <span className="block font-medium">{t.name}</span>
                        <span className="block text-sm text-muted-foreground">{t.email ?? 'No email'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {tenants && !tenants.items.length ? <li className="px-3 py-4 text-sm text-muted-foreground">No tenants found. Use “New tenant” to add one.</li> : null}
            </ul>
          </div>
        ) : step === 2 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Rent and dates</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date">
                {(p) => <Input {...p} type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />}
              </Field>
              <div className="space-y-2">
                <Field label="End date" hint={v.rolling ? 'Rolling (periodic): no fixed end date.' : undefined}>
                  {(p) => <Input {...p} type="date" disabled={v.rolling} value={v.rolling ? '' : v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />}
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={v.rolling} onCheckedChange={(c) => setV({ ...v, rolling: c })} /> Rolling (periodic)
                </label>
              </div>
              <Field label="Rent">
                {(p) => <MoneyInput {...p} value={v.rent} onChange={(e) => setV({ ...v, rent: e.target.value })} placeholder="850.00" />}
              </Field>
              <Field label="How often">
                {(p) => (
                  <NativeSelect {...p} value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value as RentFrequency })}>
                    {RENT_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {FREQUENCY_LABELS[f]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              {v.frequency === 'MONTHLY' ? (
                <Field label="Due on day" hint="The first charge is due on the start date. In shorter months, days 29–31 move to the last day of the month.">
                  {(p) => (
                    <NativeSelect {...p} value={v.dueDay} onChange={(e) => setV({ ...v, dueDay: Number(e.target.value) })}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
              ) : (
                <p className="self-end text-sm text-muted-foreground">Rent is due every {v.frequency === 'WEEKLY' ? 'week' : 'four weeks'}, counting from the start date.</p>
              )}
            </div>
            <label className="flex items-start gap-3">
              <Switch checked={v.remindersEnabled} onCheckedChange={(c) => setV({ ...v, remindersEnabled: c })} />
              <span>
                <span className="block font-medium">Email rent reminders to the tenants</span>
                <span className="block text-sm text-muted-foreground">A friendly note before rent is due, and reminders if it’s late.</span>
              </span>
            </label>
          </div>
        ) : step === 3 ? (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Deposit</h2>
            <label className="flex items-center gap-3">
              <Switch checked={v.hasDeposit} onCheckedChange={(c) => setV({ ...v, hasDeposit: c })} /> <span className="font-medium">A deposit was taken</span>
            </label>
            {v.hasDeposit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount">
                  {(p) => <MoneyInput {...p} value={v.deposit} onChange={(e) => setV({ ...v, deposit: e.target.value })} />}
                </Field>
                <Field label="Received on" optional hint="You’ll be reminded to protect it within the time set in Settings.">
                  {(p) => <Input {...p} type="date" value={v.depositReceivedOn} onChange={(e) => setV({ ...v, depositReceivedOn: e.target.value })} />}
                </Field>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">Add the scheme and protection date on the tenancy’s Deposit tab once it’s protected.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Check and create</h2>
            <FormError message={form.formError} />
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Property', unit ? `${unit.name === 'Whole property' ? '' : `${unit.name}, `}${unit.address}` : '—'],
                ['Tenants', picked.map((p) => p.name).join(', ')],
                ['Dates', `From ${formatDate(v.startDate)}${v.rolling || !v.endDate ? ', rolling' : ` to ${formatDate(v.endDate)}`}`],
                ['Rent', `${formatPence(parsePounds(v.rent) ?? 0)} ${FREQUENCY_LABELS[v.frequency].toLowerCase()}${v.frequency === 'MONTHLY' ? `, due on day ${v.dueDay}` : ''}`],
                ['Deposit', v.hasDeposit && parsePounds(v.deposit) ? formatPence(parsePounds(v.deposit)) : 'None'],
                ['Reminders', v.remindersEnabled ? 'On' : 'Off'],
              ].map(([k, val]) => (
                <div key={k} className="rounded-md bg-stone px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">Rent charges appear in the ledger by themselves, up to two weeks before each due date.</p>
          </div>
        )}
        {stepError ? (
          <p role="alert" className="mt-4 text-sm font-medium text-bad">
            {stepError}
          </p>
        ) : null}
        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={() => (step ? setStep(step - 1) : router.back())}>
            {step ? 'Back' : 'Cancel'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              disabled={form.pending}
              onClick={async () => {
                const created = await form.submit<TenancyDetail>(body(), '/tenancies');
                if (created) router.push(`/app/tenancies/${created.id}`);
              }}
            >
              {form.pending ? 'Creating…' : 'Create tenancy'}
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}

export default function NewTenancyPage() {
  return (
    <>
      <PageHeader title="New tenancy" back={{ href: '/app/tenancies', label: 'Tenancies' }} />
      <Suspense>
        <Wizard />
      </Suspense>
    </>
  );
}
