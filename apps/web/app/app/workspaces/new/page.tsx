'use client';

import { useState } from 'react';
import { createWorkspaceSchema } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setWorkspace } from '@/lib/api';
import { useForm } from '@/lib/form';

export default function NewWorkspacePage() {
  const [name, setName] = useState('');
  const form = useForm(createWorkspaceSchema);
  return (
    <>
      <PageHeader title="New workspace" description="A separate set of properties, tenants and team, for example a second business." back={{ href: '/app', label: 'Dashboard' }} />
      <Section className="max-w-lg">
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const ws = await form.submit<{ id: string }>({ name }, '/workspaces');
            if (ws) {
              setWorkspace(ws.id);
              window.location.assign('/app');
            }
          }}
        >
          <FormError message={form.formError} />
          <Field label="Workspace name" hint="Tenants see this on emails and in their portal." error={form.errors['name']}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
          </Field>
          <Button type="submit" disabled={form.pending}>
            {form.pending ? 'Creating…' : 'Create workspace'}
          </Button>
        </form>
      </Section>
    </>
  );
}
