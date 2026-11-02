'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, Camera, X } from 'lucide-react';
import { REPAIR_CATEGORIES, REPAIR_CATEGORY_LABELS, reportRepairSchema, type PortalRepair, type RepairCategory } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { cn } from '@/lib/utils';

export default function ReportRepairPage() {
  const router = useRouter();
  const [v, setV] = useState({ category: '' as RepairCategory | '', title: '', description: '', accessNotes: '', availability: '' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const form = useForm(reportRepairSchema);

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.category) return form.setErrors({ category: 'Choose what kind of problem it is' });
        const repair = await form.submit<PortalRepair>({ ...v, accessNotes: v.accessNotes || null, availability: v.availability || null }, '/portal/repairs');
        if (!repair) return;
        // Photos go up one by one after the repair exists; a failed photo doesn't lose the report.
        for (const file of photos) {
          const body = new FormData();
          body.append('file', file);
          try {
            await api(`/portal/repairs/${repair.id}/photos`, { method: 'POST', body });
          } catch (err) {
            setUploadError(errorMessage(err));
          }
        }
        router.replace(`/portal/repairs/${repair.id}?new=1`);
      }}
    >
      <h1 className="text-title font-bold">Report a repair</h1>
      <div role="note" className="flex gap-2 rounded-lg border border-bad/25 bg-bad-tint px-4 py-3 text-sm text-bad">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Smell gas? Leave the property and call <a href="tel:0800111999" className="font-bold underline">0800 111 999</a> now. For a fire, call 999.
        </span>
      </div>
      <FormError message={form.formError ?? uploadError} />
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">What kind of problem?</legend>
        <div className="grid grid-cols-2 gap-2">
          {REPAIR_CATEGORIES.map((c) => (
            <label key={c} className={cn('flex min-h-14 cursor-pointer items-center rounded-lg border border-border bg-paper px-3 py-2 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-door', v.category === c && 'border-door bg-door-tint text-door')}>
              <input type="radio" name="category" value={c} className="sr-only" checked={v.category === c} onChange={() => setV({ ...v, category: c })} />
              {REPAIR_CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
        {form.errors['category'] ? <p className="text-sm font-medium text-bad">{form.errors['category']}</p> : null}
      </fieldset>
      <Field label="In a few words" error={form.errors['title']}>
        {(p) => <Input {...p} className="h-12" placeholder="e.g. Boiler not working" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}
      </Field>
      <Field label="What’s happening?" hint="Where is it, when did it start, is it getting worse?" error={form.errors['description']}>
        {(p) => <Textarea {...p} rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}
      </Field>
      <div className="space-y-2">
        <p className="font-semibold">Photos</p>
        <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-paper font-semibold text-door hover:bg-door-tint/40">
          <Camera className="size-5" aria-hidden /> Take or choose a photo
          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 10))} />
        </label>
        {photos.length ? (
          <ul className="grid grid-cols-4 gap-2">
            {photos.map((f, i) => (
              <li key={i} className="relative aspect-square overflow-hidden rounded-md bg-stone-deep">
                <img src={URL.createObjectURL(f)} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                <button type="button" aria-label={`Remove photo ${i + 1}`} className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-slate/70 text-white" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Field label="How can someone get in?" optional hint="e.g. Key with neighbour at number 12, or I’ll be home.">
        {(p) => <Textarea {...p} rows={2} value={v.accessNotes} onChange={(e) => setV({ ...v, accessNotes: e.target.value })} />}
      </Field>
      <Field label="When are you available?" optional>
        {(p) => <Input {...p} className="h-12" placeholder="e.g. Weekday mornings" value={v.availability} onChange={(e) => setV({ ...v, availability: e.target.value })} />}
      </Field>
      <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={form.pending}>
        {form.pending ? 'Sending…' : 'Send repair report'}
      </Button>
    </form>
  );
}
