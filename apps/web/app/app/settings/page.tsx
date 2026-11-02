'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CERTIFICATE_TYPES, DOCUMENT_TYPE_LABELS, LEGAL_NOTE, REPAIR_PRIORITIES, REPAIR_PRIORITY_LABELS, workspaceSettingsSchema, type CurrentWorkspace } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Section } from '@/components/section';
import { ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@/lib/form';
import { useRole } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { LogoUpload } from '@/components/logo-upload';
import { DangerZone } from '@/components/danger-zone';

const list = (v: number[]) => v.join(', ');
const parseList = (s: string) =>
  s
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

type Values = Omit<CurrentWorkspace, 'id' | 'role' | 'hasLogo' | 'settings'> & CurrentWorkspace['settings'];

function SettingsForm({ ws, onSaved }: { ws: CurrentWorkspace; onSaved: (w: CurrentWorkspace) => void }) {
  const [v, setV] = useState<Values>({ name: ws.name, contactEmail: ws.contactEmail, contactPhone: ws.contactPhone, address: ws.address, ...ws.settings });
  const [overdue, setOverdue] = useState(list(ws.settings.reminders.overdueDays));
  const [certs, setCerts] = useState(list(ws.settings.reminders.certificateDays));
  const form = useForm(workspaceSettingsSchema);
  const reminders = (patch: Partial<Values['reminders']>) => setV((x) => ({ ...x, reminders: { ...x.reminders, ...patch } }));
  const num = (s: string) => (s === '' ? 0 : Number(s));

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const body = { ...v, reminders: { ...v.reminders, overdueDays: parseList(overdue), certificateDays: parseList(certs) } };
        const saved = await form.submit<CurrentWorkspace>(body, '/workspace/settings', { method: 'PATCH' });
        if (saved) {
          toast.success('Settings saved');
          onSaved(saved);
        }
      }}
    >
      <FormError message={form.formError} />
      <Section title="Workspace details" description="Shown on tenant emails, the portal and PDFs.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={form.errors['name']}>
            {(p) => <Input {...p} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
          </Field>
          <Field label="Contact email" optional error={form.errors['contactEmail']}>
            {(p) => <Input {...p} type="email" value={v.contactEmail ?? ''} onChange={(e) => setV({ ...v, contactEmail: e.target.value })} />}
          </Field>
          <Field label="Contact phone" optional error={form.errors['contactPhone']}>
            {(p) => <Input {...p} type="tel" value={v.contactPhone ?? ''} onChange={(e) => setV({ ...v, contactPhone: e.target.value })} />}
          </Field>
          <Field label="Postal address" optional error={form.errors['address']}>
            {(p) => <Textarea {...p} rows={2} value={v.address ?? ''} onChange={(e) => setV({ ...v, address: e.target.value })} />}
          </Field>
        </div>
      </Section>

      <Section title="Reminders" description={LEGAL_NOTE}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rent due reminder (days before)" error={form.errors['reminders.rentDueDaysBefore']}>
            {(p) => <Input {...p} type="number" min={0} max={14} value={v.reminders.rentDueDaysBefore} onChange={(e) => reminders({ rentDueDaysBefore: num(e.target.value) })} />}
          </Field>
          <Field label="Overdue reminders (days late)" hint="Separate with commas, e.g. 3, 7, 14" error={form.errors['reminders.overdueDays']}>
            {(p) => <Input {...p} value={overdue} onChange={(e) => setOverdue(e.target.value)} />}
          </Field>
          <Field label="Certificate expiry reminders (days before)" hint="Sent to Owners and Managers, e.g. 60, 30, 7" error={form.errors['reminders.certificateDays']}>
            {(p) => <Input {...p} value={certs} onChange={(e) => setCerts(e.target.value)} />}
          </Field>
          <Field label="Deposit protection reminder (days after receipt)" error={form.errors['reminders.depositProtectDays']}>
            {(p) => <Input {...p} type="number" min={1} max={60} value={v.reminders.depositProtectDays} onChange={(e) => reminders({ depositProtectDays: num(e.target.value) })} />}
          </Field>
          <Field label="Right to Rent follow-up (days before permission ends)" error={form.errors['reminders.rightToRentDaysBefore']}>
            {(p) => <Input {...p} type="number" min={1} max={90} value={v.reminders.rightToRentDaysBefore} onChange={(e) => reminders({ rightToRentDaysBefore: num(e.target.value) })} />}
          </Field>
        </div>
      </Section>

      <Section title="Repairs" description="Target response time for each priority. Repairs past their target are flagged on the dashboard.">
        <div className="grid gap-4 sm:grid-cols-3">
          {REPAIR_PRIORITIES.map((p) => (
            <Field key={p} label={`${REPAIR_PRIORITY_LABELS[p]} (hours)`} error={form.errors[`targetHours.${p}`]}>
              {(props) => <Input {...props} type="number" min={1} value={v.targetHours[p]} onChange={(e) => setV({ ...v, targetHours: { ...v.targetHours, [p]: num(e.target.value) } })} />}
            </Field>
          ))}
        </div>
        <label className="mt-5 flex items-start gap-3">
          <Switch checked={v.contractorSeesTenantContact} onCheckedChange={(c) => setV({ ...v, contractorSeesTenantContact: c })} />
          <span>
            <span className="block font-medium">Contractors see the tenant’s name and phone</span>
            <span className="block text-sm text-muted-foreground">Off: contractors arrange access through you.</span>
          </span>
        </label>
      </Section>

      <Section title="Compliance" description="Certificates every property needs. Gas safety only counts for properties with gas, and licences only for HMOs.">
        <div className="grid gap-3 sm:grid-cols-2">
          {CERTIFICATE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-3">
              <Checkbox
                checked={v.requiredCertificates.includes(t)}
                onCheckedChange={(c) => setV({ ...v, requiredCertificates: c ? [...v.requiredCertificates, t] : v.requiredCertificates.filter((x) => x !== t) })}
              />
              {DOCUMENT_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Data retention" description="Tenant personal details are anonymised this many years after their last tenancy ends. Rent totals are kept.">
        <Field label="Years to keep tenant details" className="max-w-xs" error={form.errors['retentionYears']}>
          {(p) => <Input {...p} type="number" min={1} max={10} value={v.retentionYears} onChange={(e) => setV({ ...v, retentionYears: num(e.target.value) })} />}
        </Field>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-border bg-stone/95 px-1 py-3 backdrop-blur">
        <Button type="submit" disabled={form.pending}>
          {form.pending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}

export default function WorkspaceSettingsPage() {
  const { isManager, isOwner } = useRole();
  const { data, error, loading, reload, setData } = useApi<CurrentWorkspace>(isManager ? '/workspace' : null);
  const [key, setKey] = useState(0);
  useEffect(() => setKey((k) => k + 1), [data?.id]);
  if (!isManager) return <ErrorState error={new Error('Only Owners and Managers can change workspace settings.')} />;
  if (loading && !data) return <ListSkeleton rows={6} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <LogoUpload hasLogo={data.hasLogo} workspaceId={data.id} onChange={reload} />
      <SettingsForm key={key} ws={data} onSaved={setData} />
      {isOwner ? <DangerZone name={data.name} /> : null}
    </div>
  );
}
