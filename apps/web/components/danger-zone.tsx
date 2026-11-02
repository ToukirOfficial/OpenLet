'use client';

import { useState } from 'react';
import { deleteWorkspaceSchema } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { FormDialog } from '@/components/form-dialog';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setWorkspace } from '@/lib/api';
import { useForm } from '@/lib/form';

/** Owner only: delete the workspace and everything in it, after typing its name. */
export function DangerZone({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const form = useForm(deleteWorkspaceSchema);
  return (
    <Section title="Delete workspace" description="Deletes every property, tenant, tenancy, document and message in this workspace. This can’t be undone." className="border-bad/30">
      <FormDialog
        title={`Delete ${name}?`}
        description="Download a full data export first if you might need anything. Type the workspace name to confirm."
        open={open}
        onOpenChange={setOpen}
        trigger={<Button variant="outline" className="border-bad/40 text-bad hover:bg-bad-tint">Delete this workspace</Button>}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (await form.submit({ confirmName }, '/workspace/delete')) {
              setWorkspace(null);
              window.location.assign('/app');
            }
          }}
        >
          <FormError message={form.formError} />
          <Field label={`Type “${name}”`} error={form.errors['confirmName']}>
            {(p) => <Input {...p} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />}
          </Field>
          <Button type="submit" className="bg-bad hover:bg-bad/90" disabled={form.pending || confirmName.trim() !== name.trim()}>
            {form.pending ? 'Deleting…' : 'Delete forever'}
          </Button>
        </form>
      </FormDialog>
    </Section>
  );
}
