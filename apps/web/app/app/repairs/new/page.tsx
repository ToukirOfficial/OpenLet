'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { REPAIR_CATEGORIES, REPAIR_CATEGORY_LABELS, REPAIR_PRIORITIES, REPAIR_PRIORITY_LABELS, staffRepairSchema, type PropertyOption, type RepairCategory, type RepairDetail, type RepairPriority } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Section } from '@/components/section';
import { ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';

function NewRepair() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: properties } = useApi<PropertyOption[]>('/properties/options');
  const [v, setV] = useState({ propertyId: params.get('propertyId') ?? '', unitId: '', category: 'HEATING' as RepairCategory, title: '', description: '', priority: 'ROUTINE' as RepairPriority, accessNotes: '', availability: '' });
  const form = useForm(staffRepairSchema);
  const property = properties?.find((p) => p.id === v.propertyId);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  if (!properties) return <ListSkeleton rows={5} />;
  return (
    <Section className="max-w-3xl">
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await form.submit<RepairDetail>({ ...v, unitId: v.unitId || null, accessNotes: v.accessNotes || null, availability: v.availability || null }, '/repairs');
          if (saved) router.push(`/app/repairs/${saved.id}`);
        }}
      >
        <FormError message={form.formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property" error={form.errors['propertyId']}>
            {(p) => (
              <NativeSelect {...p} value={v.propertyId} onChange={(e) => setV({ ...v, propertyId: e.target.value, unitId: '' })}>
                <option value="">Choose a property</option>
                {properties.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.address}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {property && property.units.length > 1 ? (
            <Field label="Unit" optional>
              {(p) => (
                <NativeSelect {...p} value={v.unitId} onChange={set('unitId')}>
                  <option value="">Shared areas / whole building</option>
                  {property.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          ) : (
            <div />
          )}
          <Field label="Category">
            {(p) => (
              <NativeSelect {...p} value={v.category} onChange={set('category')}>
                {REPAIR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {REPAIR_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Priority" hint="Sets the target response time (Settings).">
            {(p) => (
              <NativeSelect {...p} value={v.priority} onChange={set('priority')}>
                {REPAIR_PRIORITIES.map((c) => (
                  <option key={c} value={c}>
                    {REPAIR_PRIORITY_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>
        <Field label="Short title" error={form.errors['title']}>
          {(p) => <Input {...p} value={v.title} onChange={set('title')} placeholder="e.g. Boiler not working" />}
        </Field>
        <Field label="What’s wrong" error={form.errors['description']}>
          {(p) => <Textarea {...p} rows={4} value={v.description} onChange={set('description')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Access notes" optional hint="Shared with the contractor.">
            {(p) => <Textarea {...p} rows={2} value={v.accessNotes} onChange={set('accessNotes')} />}
          </Field>
          <Field label="Tenant availability" optional>
            {(p) => <Textarea {...p} rows={2} value={v.availability} onChange={set('availability')} />}
          </Field>
        </div>
        <Button type="submit" disabled={form.pending}>
          {form.pending ? 'Saving…' : 'Log repair'}
        </Button>
      </form>
    </Section>
  );
}

export default function NewRepairPage() {
  return (
    <>
      <PageHeader title="Log a repair" back={{ href: '/app/repairs', label: 'Repairs' }} />
      <Suspense>
        <NewRepair />
      </Suspense>
    </>
  );
}
