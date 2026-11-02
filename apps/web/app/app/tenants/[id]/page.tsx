'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RTR_METHODS, RTR_METHOD_LABELS, TENANCY_STATUS_LABELS, formatDate, londonDate, rightToRentSchema, type RtrMethod, type TenancyStatus, type TenantDetail } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Confirm } from '@/components/confirm';
import { DocumentsPanel } from '@/components/documents-panel';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { NotesPanel } from '@/components/notes-panel';
import { RecordTabs } from '@/components/record-tabs';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { TenantForm } from '@/components/tenant-form';
import { Timeline } from '@/components/timeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useForm } from '@/lib/form';
import { useRole } from '@/lib/session';
import { PORTAL_LABEL, TENANCY_TONE } from '@/lib/tones';
import { useApi } from '@/lib/use-api';
import { TenantPortalInvite } from '@/components/tenant-invite';

function RightToRent({ t, onChange }: { t: TenantDetail; onChange: (t: TenantDetail) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ checkedOn: londonDate(), method: 'MANUAL_DOCUMENT' as RtrMethod, expiresOn: '', notes: '' });
  const form = useForm(rightToRentSchema);
  const today = londonDate();
  return (
    <Section
      title="Right to Rent (England)"
      description="Record each check. For time-limited permission, add the date it ends and you’ll get a reminder before the follow-up check."
      actions={
        <FormDialog title="Record a Right to Rent check" open={open} onOpenChange={setOpen} trigger={<Button size="sm" variant="outline"><ShieldCheck className="size-4" /> Record a check</Button>}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const saved = await form.submit<TenantDetail>(v, `/tenants/${t.id}/right-to-rent`);
              if (saved) {
                setOpen(false);
                onChange(saved);
                toast.success('Check recorded');
              }
            }}
          >
            <FormError message={form.formError} />
            <Field label="Date checked" error={form.errors['checkedOn']}>
              {(p) => <Input {...p} type="date" value={v.checkedOn} onChange={(e) => setV({ ...v, checkedOn: e.target.value })} />}
            </Field>
            <Field label="How it was checked">
              {(p) => (
                <NativeSelect {...p} value={v.method} onChange={(e) => setV({ ...v, method: e.target.value as RtrMethod })}>
                  {RTR_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {RTR_METHOD_LABELS[m]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Permission ends on" optional hint="Only for time-limited permission to stay in the UK." error={form.errors['expiresOn']}>
              {(p) => <Input {...p} type="date" value={v.expiresOn} onChange={(e) => setV({ ...v, expiresOn: e.target.value })} />}
            </Field>
            <Field label="Notes" optional>
              {(p) => <Textarea {...p} rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />}
            </Field>
            <p className="text-sm text-muted-foreground">Upload the evidence on the Documents tab as “Right to Rent evidence”.</p>
            <Button type="submit" disabled={form.pending}>
              Save check
            </Button>
          </form>
        </FormDialog>
      }
    >
      {!t.rightToRent.length ? (
        <EmptyState icon={ShieldCheck} title="No checks recorded">
          In England, landlords must check every adult tenant’s right to rent before the tenancy starts.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {t.rightToRent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1">
                <p className="font-medium">Checked {formatDate(r.checkedOn)}</p>
                <p className="text-sm text-muted-foreground">{RTR_METHOD_LABELS[r.method]}</p>
              </div>
              {r.expiresOn ? (
                <StatusBadge tone={r.expiresOn < today ? 'bad' : 'warn'}>Permission ends {formatDate(r.expiresOn)}</StatusBadge>
              ) : (
                <StatusBadge tone="ok">No time limit</StatusBadge>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label="Delete check"
                onClick={async () => {
                  onChange(await api<TenantDetail>(`/tenants/${t.id}/right-to-rent/${r.id}`, { method: 'DELETE' }));
                }}
              >
                <Trash2 className="size-4 text-bad" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function TenantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isManager } = useRole();
  const { data: t, error, loading, reload, setData } = useApi<TenantDetail>(`/tenants/${id}`);
  const [editing, setEditing] = useState(false);

  if (loading && !t) return <ListSkeleton rows={6} />;
  if (error || !t) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        back={{ href: '/app/tenants', label: 'Tenants' }}
        title={t.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {t.currentAddress ?? 'No current tenancy'}
            <StatusBadge tone={PORTAL_LABEL[t.portal][1]}>{PORTAL_LABEL[t.portal][0]}</StatusBadge>
            {t.anonymised ? <StatusBadge tone="neutral">Anonymised</StatusBadge> : null}
          </span>
        }
        actions={
          t.anonymised ? null : (
            <>
              <TenantPortalInvite tenant={t} onChange={reload} />
              <FormDialog title="Edit tenant" open={editing} onOpenChange={setEditing} wide trigger={<Button variant="outline"><Pencil className="size-4" /> Edit</Button>}>
                <TenantForm
                  tenant={t}
                  onSaved={(saved) => {
                    setData(saved);
                    setEditing(false);
                    toast.success('Tenant updated');
                  }}
                />
              </FormDialog>
              {isManager && !t.tenancies.length ? (
                <Confirm
                  title={`Delete ${t.name}?`}
                  description="Their record and documents are removed for good."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={async () => {
                    await api(`/tenants/${t.id}`, { method: 'DELETE' });
                    toast.success('Tenant deleted');
                    router.push('/app/tenants');
                  }}
                >
                  <Button variant="ghost">
                    <Trash2 className="size-4" /> Delete
                  </Button>
                </Confirm>
              ) : null}
            </>
          )
        }
      />
      <RecordTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'tenancies', label: 'Tenancies', count: t.tenancies.length },
          { id: 'documents', label: 'Documents' },
          { id: 'notes', label: 'Notes' },
          { id: 'timeline', label: 'Timeline' },
        ]}
      >
        {(tab) =>
          tab === 'overview' ? (
            <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <Section title="Contact">
                <dl className="space-y-3 text-sm">
                  {[
                    ['Email', t.email],
                    ['Phone', t.phone],
                    ['Date of birth', t.dateOfBirth ? formatDate(t.dateOfBirth) : null],
                    ['Emergency contact', [t.emergencyName, t.emergencyPhone].filter(Boolean).join(', ') || null],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v ?? '—'}</dd>
                    </div>
                  ))}
                  {t.notes ? (
                    <div>
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd className="whitespace-pre-wrap">{t.notes}</dd>
                    </div>
                  ) : null}
                </dl>
              </Section>
              <RightToRent t={t} onChange={setData} />
            </div>
          ) : tab === 'tenancies' ? (
            <Section title="Tenancies" flush>
              {!t.tenancies.length ? (
                <div className="p-5">
                  <EmptyState
                    icon={ShieldCheck}
                    title="No tenancies yet"
                    action={
                      <Button asChild size="sm">
                        <Link href={`/app/tenancies/new?tenantId=${t.id}`}>Create a tenancy</Link>
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {t.tenancies.map((x) => (
                    <li key={x.id} className="relative flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <div className="flex-1">
                        <Link href={`/app/tenancies/${x.id}`} className="font-semibold after:absolute after:inset-0 hover:text-door">
                          {x.address}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          From {formatDate(x.startDate)} {x.endDate ? `to ${formatDate(x.endDate)}` : '(rolling)'}
                        </p>
                      </div>
                      <StatusBadge tone={TENANCY_TONE[x.status as TenancyStatus]}>{TENANCY_STATUS_LABELS[x.status as TenancyStatus]}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : tab === 'documents' ? (
            <DocumentsPanel owner={{ tenantId: t.id }} types={['RIGHT_TO_RENT_EVIDENCE', 'OTHER', 'PHOTO']} description="Right to Rent evidence and other documents about this person." showShare={false} />
          ) : tab === 'notes' ? (
            <NotesPanel owner={{ tenantId: t.id }} />
          ) : (
            <Timeline owner={{ tenantId: t.id }} />
          )
        }
      </RecordTabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TenantPage />
    </Suspense>
  );
}
