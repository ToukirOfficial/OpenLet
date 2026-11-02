'use client';

import { useState } from 'react';
import { HardHat, Mail, Pencil, Phone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { contractorSchema, type ContractorItem } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Confirm } from '@/components/confirm';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';

function ContractorForm({ c, onDone }: { c?: ContractorItem; onDone: () => void }) {
  const [v, setV] = useState({ name: c?.name ?? '', company: c?.company ?? '', trade: c?.trade ?? '', email: c?.email ?? '', phone: c?.phone ?? '', notes: c?.notes ?? '' });
  const form = useForm(contractorSchema);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (await form.submit(v, c ? `/contractors/${c.id}` : '/contractors', { method: c ? 'PATCH' : 'POST' })) {
          toast.success(c ? 'Contractor updated' : 'Contractor added');
          onDone();
        }
      }}
    >
      <FormError message={form.formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={form.errors['name']}>
          {(p) => <Input {...p} value={v.name} onChange={set('name')} />}
        </Field>
        <Field label="Company" optional error={form.errors['company']}>
          {(p) => <Input {...p} value={v.company} onChange={set('company')} />}
        </Field>
        <Field label="Trade" hint="e.g. Gas engineer, Plumber, Electrician" error={form.errors['trade']}>
          {(p) => <Input {...p} value={v.trade} onChange={set('trade')} />}
        </Field>
        <Field label="Email" hint="Job links are sent here." error={form.errors['email']}>
          {(p) => <Input {...p} type="email" value={v.email} onChange={set('email')} />}
        </Field>
        <Field label="Phone" optional error={form.errors['phone']}>
          {(p) => <Input {...p} type="tel" value={v.phone} onChange={set('phone')} />}
        </Field>
      </div>
      <Field label="Notes" optional>
        {(p) => <Textarea {...p} rows={2} value={v.notes} onChange={set('notes')} />}
      </Field>
      <Button type="submit" disabled={form.pending}>
        {c ? 'Save changes' : 'Add contractor'}
      </Button>
    </form>
  );
}

export default function ContractorsPage() {
  const { data, error, loading, reload } = useApi<ContractorItem[]>('/contractors');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ContractorItem | null>(null);
  return (
    <>
      <PageHeader
        title="Contractors"
        description="The trades you send repairs to. They get a secure job link by email, no account needed."
        actions={
          <FormDialog title="Add a contractor" open={adding} onOpenChange={setAdding} wide trigger={<Button><Plus className="size-4" /> Add contractor</Button>}>
            <ContractorForm
              onDone={() => {
                setAdding(false);
                void reload();
              }}
            />
          </FormDialog>
        }
      />
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.length ? (
        <EmptyState icon={HardHat} title="No contractors yet" action={<Button onClick={() => setAdding(true)}>Add contractor</Button>}>
          Add your gas engineer, plumber and electrician so you can assign repairs in one click.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data!.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-border bg-paper p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.trade}
                    {c.company ? `, ${c.company}` : ''}
                  </p>
                </div>
                {c.openJobs ? <span className="rounded-full bg-info-tint px-2 py-0.5 text-xs font-semibold text-info">{c.openJobs} open</span> : null}
              </div>
              <div className="space-y-1 text-sm">
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-door">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden /> {c.email}
                </a>
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-door">
                    <Phone className="size-3.5 text-muted-foreground" aria-hidden /> {c.phone}
                  </a>
                ) : null}
              </div>
              {c.notes ? <p className="text-sm text-muted-foreground">{c.notes}</p> : null}
              <div className="mt-auto flex gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Confirm
                  title={`Remove ${c.name}?`}
                  description="They won’t be offered for new repairs. Past jobs still show their name."
                  confirmLabel="Remove"
                  onConfirm={async () => {
                    await api(`/contractors/${c.id}`, { method: 'DELETE' });
                    await reload();
                  }}
                >
                  <Button variant="ghost" size="sm">
                    Remove
                  </Button>
                </Confirm>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormDialog title="Edit contractor" open={!!editing} onOpenChange={(o) => !o && setEditing(null)} wide>
        {editing ? (
          <ContractorForm
            c={editing}
            onDone={() => {
              setEditing(null);
              void reload();
            }}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
