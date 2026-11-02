'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { portalContactSchema, type PortalDetails } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';

export default function PortalDetailsPage() {
  const { data, error, reload, setData } = useApi<PortalDetails>('/portal/details');
  const [v, setV] = useState({ phone: '', emergencyName: '', emergencyPhone: '' });
  const form = useForm(portalContactSchema);
  useEffect(() => {
    if (data) setV({ phone: data.phone ?? '', emergencyName: data.emergencyName ?? '', emergencyPhone: data.emergencyPhone ?? '' });
  }, [data]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <ListSkeleton rows={4} />;
  return (
    <div className="space-y-5">
      <h1 className="text-title font-bold">My details</h1>
      <div className="rounded-lg border border-border bg-paper px-4 py-3">
        <p className="font-semibold">
          {data.firstName} {data.lastName}
        </p>
        <p className="text-sm text-muted-foreground">{data.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">To change your name or email, send a message to your landlord or agent.</p>
      </div>
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await form.submit<PortalDetails>(v, '/portal/contact', { method: 'PATCH' });
          if (saved) {
            setData(saved);
            toast.success('Details saved');
          }
        }}
      >
        <FormError message={form.formError} />
        <Field label="Phone" error={form.errors['phone']}>
          {(p) => <Input {...p} type="tel" autoComplete="tel" className="h-12" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}
        </Field>
        <Field label="Emergency contact name" optional error={form.errors['emergencyName']}>
          {(p) => <Input {...p} className="h-12" value={v.emergencyName} onChange={(e) => setV({ ...v, emergencyName: e.target.value })} />}
        </Field>
        <Field label="Emergency contact phone" optional error={form.errors['emergencyPhone']}>
          {(p) => <Input {...p} type="tel" className="h-12" value={v.emergencyPhone} onChange={(e) => setV({ ...v, emergencyPhone: e.target.value })} />}
        </Field>
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.pending}>
          {form.pending ? 'Saving…' : 'Save my details'}
        </Button>
      </form>
    </div>
  );
}
