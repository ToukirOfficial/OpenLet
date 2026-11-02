'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Archive, BedDouble, Flame, Pencil, Plus, Sofa } from 'lucide-react';
import { toast } from 'sonner';
import { FREQUENCY_SHORT, FURNISHED_LABELS, PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS, TENANCY_STATUS_LABELS, formatDate, formatPence, unitSchema, type PropertyDetail, type RentFrequency, type TenancyStatus } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Confirm } from '@/components/confirm';
import { DocumentsPanel } from '@/components/documents-panel';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { NotesPanel } from '@/components/notes-panel';
import { RecordTabs } from '@/components/record-tabs';
import { Section } from '@/components/section';
import { ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Timeline } from '@/components/timeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrl } from '@/lib/api';
import { useForm } from '@/lib/form';
import { useRole } from '@/lib/session';
import { PROPERTY_TONE, TENANCY_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';
import { PropertyRepairs } from '@/components/property-extras';

function AddUnit({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const form = useForm(unitSchema);
  return (
    <FormDialog title="Add a unit" description="A flat or room that’s let on its own." open={open} onOpenChange={setOpen} trigger={<Button variant="outline" size="sm"><Plus className="size-4" /> Add unit</Button>}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await form.submit({ name }, `/properties/${propertyId}/units`)) {
            setOpen(false);
            setName('');
            onDone();
          }
        }}
      >
        <FormError message={form.formError} />
        <Field label="Name" error={form.errors['name']}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 4 or Flat 2" autoFocus />}
        </Field>
        <Button type="submit" disabled={form.pending}>
          Add unit
        </Button>
      </form>
    </FormDialog>
  );
}

function Overview({ p, reload }: { p: PropertyDetail; reload: () => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Section title="Units and tenancies" actions={<AddUnit propertyId={p.id} onDone={reload} />} flush>
        <ul className="divide-y divide-border">
          {p.units.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{u.name}</p>
                {u.tenancy ? (
                  <p className="text-sm text-muted-foreground">
                    {u.tenancy.tenantNames} · {formatPence(u.tenancy.rentPence)} {FREQUENCY_SHORT[u.tenancy.frequency as RentFrequency]}
                    {u.tenancy.endDate ? ` · until ${formatDate(u.tenancy.endDate)}` : ' · rolling'}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No tenancy</p>
                )}
              </div>
              {u.tenancy ? (
                <div className="flex items-center gap-3">
                  <StatusBadge tone={TENANCY_TONE[u.tenancy.status as TenancyStatus]}>{TENANCY_STATUS_LABELS[u.tenancy.status as TenancyStatus]}</StatusBadge>
                  <Link href={`/app/tenancies/${u.tenancy.id}`} className="text-sm font-semibold text-door hover:underline">
                    Open tenancy
                  </Link>
                </div>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/tenancies/new?unitId=${u.id}`}>Create tenancy</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Details">
        <dl className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <BedDouble className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Rooms</dt>
            <dd>
              {p.bedrooms} bedrooms, {p.bathrooms} bathroom{p.bathrooms === 1 ? '' : 's'}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Sofa className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Furnishing</dt>
            <dd>{FURNISHED_LABELS[p.furnished]}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Gas</dt>
            <dd>{p.hasGas ? 'Gas supply' : 'No gas'}</dd>
          </div>
          {p.notes ? (
            <div className="border-t border-border pt-3">
              <dt className="mb-1 text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{p.notes}</dd>
            </div>
          ) : null}
        </dl>
      </Section>
    </div>
  );
}

function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isManager } = useRole();
  const { data: p, error, loading, reload } = useApi<PropertyDetail>(`/properties/${id}`);

  if (loading && !p) return <ListSkeleton rows={6} />;
  if (error || !p) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end">
        {p.coverDocId ? (
          <img src={apiUrl(`/documents/${p.coverDocId}/download?inline=1`)} alt="" className="h-28 w-full rounded-lg object-cover sm:w-44" />
        ) : null}
        <div className="flex-1">
          <PageHeader
            back={{ href: '/app/properties', label: 'Properties' }}
            title={p.addressLine1}
            description={
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  {[p.addressLine2, p.town, p.postcode].filter(Boolean).join(', ')} · {PROPERTY_TYPE_LABELS[p.type]}
                </span>
                <StatusBadge tone={PROPERTY_TONE[p.status]}>{PROPERTY_STATUS_LABELS[p.status]}</StatusBadge>
                {p.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
              </span>
            }
            actions={
              <>
                <Button asChild variant="outline">
                  <Link href={`/app/properties/${p.id}/edit`}>
                    <Pencil className="size-4" /> Edit
                  </Link>
                </Button>
                {isManager && !p.archived ? (
                  <Confirm
                    title="Archive this property?"
                    description="It disappears from lists. Properties without any tenancies are deleted instead. Tenancy and rent history is always kept."
                    confirmLabel="Archive"
                    onConfirm={async () => {
                      const res = await api<{ archived: boolean }>(`/properties/${p.id}`, { method: 'DELETE' });
                      toast.success(res.archived ? 'Property archived' : 'Property deleted');
                      router.push('/app/properties');
                    }}
                  >
                    <Button variant="ghost">
                      <Archive className="size-4" /> Archive
                    </Button>
                  </Confirm>
                ) : null}
              </>
            }
          />
        </div>
      </div>
      <RecordTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'repairs', label: 'Repairs', count: p.openRepairs },
          { id: 'documents', label: 'Documents and certificates' },
          { id: 'notes', label: 'Notes' },
          { id: 'timeline', label: 'Timeline' },
        ]}
      >
        {(tab) =>
          tab === 'overview' ? (
            <Overview p={p} reload={reload} />
          ) : tab === 'repairs' ? (
            <PropertyRepairs propertyId={p.id} />
          ) : tab === 'documents' ? (
            <DocumentsPanel owner={{ propertyId: p.id }} description="Certificates, inventories and photos for this property." />
          ) : tab === 'notes' ? (
            <NotesPanel owner={{ propertyId: p.id }} />
          ) : (
            <Timeline owner={{ propertyId: p.id }} />
          )
        }
      </RecordTabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <PropertyPage />
    </Suspense>
  );
}
