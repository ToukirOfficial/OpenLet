'use client';

import { useState } from 'react';
import { MailPlus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { inviteMemberSchema, ROLE_LABELS, WORKSPACE_ROLES, formatDateTime, type Team, type WorkspaceRole } from '@openlet/shared';
import { Confirm } from '@/components/confirm';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';

const ROLE_HELP: Record<WorkspaceRole, string> = {
  OWNER: 'Everything, including the team and deleting the workspace.',
  MANAGER: 'Everything except the team and deleting the workspace.',
  STAFF: 'Day-to-day work. No settings and no exports.',
};

function InviteForm({ onDone }: { onDone: () => void }) {
  const [values, setValues] = useState({ email: '', role: 'STAFF' as WorkspaceRole });
  const form = useForm(inviteMemberSchema);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (await form.submit(values, '/members/invites')) {
          toast.success(`Invite sent to ${values.email}`);
          onDone();
        }
      }}
    >
      <FormError message={form.formError} />
      <Field label="Email" error={form.errors['email']}>
        {(p) => <Input {...p} type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} autoFocus />}
      </Field>
      <Field label="Role" hint={ROLE_HELP[values.role]}>
        {(p) => (
          <NativeSelect {...p} value={values.role} onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as WorkspaceRole }))}>
            {WORKSPACE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Button type="submit" disabled={form.pending}>
        <MailPlus className="size-4" /> {form.pending ? 'Sending…' : 'Send invite'}
      </Button>
    </form>
  );
}

export default function TeamPage() {
  const { data, error, loading, reload } = useApi<Team>('/members');
  const [open, setOpen] = useState(false);

  async function changeRole(id: string, role: WorkspaceRole) {
    try {
      await api(`/members/${id}`, { method: 'PATCH', body: { role } });
      toast.success('Role changed');
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
      await reload();
    }
  }

  return (
    <div className="space-y-6">
      <Section
        title="Team"
        description="People who work in this workspace."
        actions={
          <FormDialog title="Invite a team member" description="They’ll get an email with a link that works for 7 days." open={open} onOpenChange={setOpen} trigger={<Button><UserPlus className="size-4" /> Invite someone</Button>}>
            <InviteForm
              onDone={() => {
                setOpen(false);
                void reload();
              }}
            />
          </FormDialog>
        }
        flush
      >
        {loading && !data ? (
          <div className="p-5">
            <ListSkeleton rows={3} />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-semibold">
                    {m.name} {m.isYou ? <span className="font-normal text-muted-foreground">(you)</span> : null}
                  </TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <NativeSelect size="sm" aria-label={`Role for ${m.name}`} className="w-36" value={m.role} onChange={(e) => void changeRole(m.id, e.target.value as WorkspaceRole)}>
                      {WORKSPACE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(m.joinedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Confirm
                      title={`Remove ${m.name}?`}
                      description="They lose access to this workspace straight away. Their past activity stays on record."
                      confirmLabel="Remove"
                      destructive
                      onConfirm={async () => {
                        await api(`/members/${m.id}`, { method: 'DELETE' });
                        toast.success(`${m.name} removed`);
                        await reload();
                      }}
                    >
                      <Button variant="ghost" size="sm" className="text-bad hover:text-bad">
                        Remove
                      </Button>
                    </Confirm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Pending invites" description="Invites that haven’t been accepted yet.">
        {!data ? (
          <ListSkeleton rows={1} />
        ) : data.invites.length === 0 ? (
          <EmptyState icon={Users} title="No pending invites">
            Invite a manager or staff member to share the work.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-medium">{i.email}</span>
                <Badge variant="outline">{i.role ? ROLE_LABELS[i.role] : 'Member'}</Badge>
                {i.expired ? <Badge className="bg-warn-tint text-warn">Expired</Badge> : <span className="text-sm text-muted-foreground">Expires {formatDateTime(i.expiresAt)}</span>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={async () => {
                    try {
                      await api(`/members/invites/${i.id}`, { method: 'DELETE' });
                      toast.success('Invite withdrawn');
                      await reload();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
