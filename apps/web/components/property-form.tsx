'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { FURNISHED, FURNISHED_LABELS, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, propertySchema, propertyUpdateSchema, type Furnished, type PropertyDetail, type PropertyType } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@/lib/form';

export function PropertyForm({ property }: { property?: PropertyDetail }) {
  const router = useRouter();
  const editing = !!property;
  const [v, setV] = useState({
    addressLine1: property?.addressLine1 ?? '',
    addressLine2: property?.addressLine2 ?? '',
    town: property?.town ?? '',
    county: property?.county ?? '',
    postcode: property?.postcode ?? '',
    type: (property?.type ?? 'HOUSE') as PropertyType,
    bedrooms: property?.bedrooms ?? 2,
    bathrooms: property?.bathrooms ?? 1,
    furnished: (property?.furnished ?? 'UNFURNISHED') as Furnished,
    hasGas: property?.hasGas ?? true,
    notes: property?.notes ?? '',
  });
  const [multi, setMulti] = useState(false);
  const [units, setUnits] = useState<string[]>(['Room 1', 'Room 2']);
  const form = useForm(editing ? propertyUpdateSchema : propertySchema);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const int = (k: 'bedrooms' | 'bathrooms') => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value === '' ? 0 : Number(e.target.value) }));

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const body = editing ? v : { ...v, units: multi ? units.filter((u) => u.trim()) : undefined };
        const saved = await form.submit<PropertyDetail>(body, editing ? `/properties/${property.id}` : '/properties', { method: editing ? 'PATCH' : 'POST' });
        if (saved) router.push(`/app/properties/${saved.id}`);
      }}
    >
      <FormError message={form.formError} />
      <Section title="Address">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" className="sm:col-span-2" error={form.errors['addressLine1']}>
            {(p) => <Input {...p} autoComplete="address-line1" value={v.addressLine1} onChange={set('addressLine1')} />}
          </Field>
          <Field label="Address line 2" optional className="sm:col-span-2" error={form.errors['addressLine2']}>
            {(p) => <Input {...p} autoComplete="address-line2" value={v.addressLine2} onChange={set('addressLine2')} />}
          </Field>
          <Field label="Town or city" error={form.errors['town']}>
            {(p) => <Input {...p} autoComplete="address-level2" value={v.town} onChange={set('town')} />}
          </Field>
          <Field label="County" optional error={form.errors['county']}>
            {(p) => <Input {...p} value={v.county} onChange={set('county')} />}
          </Field>
          <Field label="Postcode" error={form.errors['postcode']}>
            {(p) => <Input {...p} autoComplete="postal-code" className="uppercase" value={v.postcode} onChange={set('postcode')} />}
          </Field>
        </div>
      </Section>
      <Section title="About the property">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Type">
            {(p) => (
              <NativeSelect {...p} value={v.type} onChange={set('type')}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROPERTY_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Bedrooms" error={form.errors['bedrooms']}>
            {(p) => <Input {...p} type="number" min={0} value={v.bedrooms} onChange={int('bedrooms')} />}
          </Field>
          <Field label="Bathrooms" error={form.errors['bathrooms']}>
            {(p) => <Input {...p} type="number" min={0} value={v.bathrooms} onChange={int('bathrooms')} />}
          </Field>
          <Field label="Furnishing">
            {(p) => (
              <NativeSelect {...p} value={v.furnished} onChange={set('furnished')}>
                {FURNISHED.map((f) => (
                  <option key={f} value={f}>
                    {FURNISHED_LABELS[f]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>
        <label className="mt-5 flex items-start gap-3">
          <Switch checked={v.hasGas} onCheckedChange={(c) => setV((x) => ({ ...x, hasGas: c }))} />
          <span>
            <span className="block font-medium">Has a gas supply</span>
            <span className="block text-sm text-muted-foreground">If on, a gas safety certificate is needed every year.</span>
          </span>
        </label>
        <Field label="Notes" optional className="mt-5" hint="Visible to your team only.">
          {(p) => <Textarea {...p} rows={3} value={v.notes} onChange={set('notes')} />}
        </Field>
      </Section>
      {!editing ? (
        <Section title="Units" description="A house let as a whole is one unit. Rooms in an HMO or flats in a block are let separately.">
          <label className="flex items-center gap-3">
            <Switch checked={multi} onCheckedChange={setMulti} />
            <span className="font-medium">This property is let as separate units</span>
          </label>
          {multi ? (
            <div className="mt-4 space-y-2">
              {units.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label={`Unit ${i + 1} name`} value={u} onChange={(e) => setUnits((list) => list.map((x, j) => (j === i ? e.target.value : x)))} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${u || 'unit'}`} onClick={() => setUnits((list) => list.filter((_, j) => j !== i))} disabled={units.length <= 1}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setUnits((list) => [...list, `${v.type === 'HMO' ? 'Room' : 'Flat'} ${list.length + 1}`])}>
                <Plus className="size-4" /> Add unit
              </Button>
            </div>
          ) : null}
        </Section>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={form.pending}>
          {form.pending ? 'Saving…' : editing ? 'Save changes' : 'Add property'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
