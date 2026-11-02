'use client';

import { useState } from 'react';
import { tenantSchema, type TenantDetail } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@/lib/form';

export function TenantForm({ tenant, onSaved, submitLabel }: { tenant?: TenantDetail; onSaved: (t: TenantDetail) => void; submitLabel?: string }) {
  const [v, setV] = useState({
    firstName: tenant?.firstName ?? '',
    lastName: tenant?.lastName ?? '',
    email: tenant?.email ?? '',
    phone: tenant?.phone ?? '',
    dateOfBirth: tenant?.dateOfBirth ?? '',
    emergencyName: tenant?.emergencyName ?? '',
    emergencyPhone: tenant?.emergencyPhone ?? '',
    notes: tenant?.notes ?? '',
  });
  const form = useForm(tenantSchema);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const saved = await form.submit<TenantDetail>(v, tenant ? `/tenants/${tenant.id}` : '/tenants', { method: tenant ? 'PATCH' : 'POST' });
        if (saved) onSaved(saved);
      }}
    >
      <FormError message={form.formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={form.errors['firstName']}>
          {(p) => <Input {...p} autoComplete="off" value={v.firstName} onChange={set('firstName')} />}
        </Field>
        <Field label="Last name" error={form.errors['lastName']}>
          {(p) => <Input {...p} autoComplete="off" value={v.lastName} onChange={set('lastName')} />}
        </Field>
        <Field label="Email" optional hint="Needed for reminders and the tenant portal." error={form.errors['email']}>
          {(p) => <Input {...p} type="email" autoComplete="off" value={v.email} onChange={set('email')} />}
        </Field>
        <Field label="Phone" optional error={form.errors['phone']}>
          {(p) => <Input {...p} type="tel" autoComplete="off" value={v.phone} onChange={set('phone')} />}
        </Field>
        <Field label="Date of birth" optional error={form.errors['dateOfBirth']}>
          {(p) => <Input {...p} type="date" value={v.dateOfBirth} onChange={set('dateOfBirth')} />}
        </Field>
        <div />
        <Field label="Emergency contact name" optional error={form.errors['emergencyName']}>
          {(p) => <Input {...p} autoComplete="off" value={v.emergencyName} onChange={set('emergencyName')} />}
        </Field>
        <Field label="Emergency contact phone" optional error={form.errors['emergencyPhone']}>
          {(p) => <Input {...p} type="tel" autoComplete="off" value={v.emergencyPhone} onChange={set('emergencyPhone')} />}
        </Field>
      </div>
      <Field label="Notes" optional hint="Visible to your team only." error={form.errors['notes']}>
        {(p) => <Textarea {...p} rows={3} value={v.notes} onChange={set('notes')} />}
      </Field>
      <Button type="submit" disabled={form.pending}>
        {form.pending ? 'Saving…' : (submitLabel ?? (tenant ? 'Save changes' : 'Add tenant'))}
      </Button>
    </form>
  );
}
