'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { changePasswordSchema } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { useForm } from '@/lib/form';
import { useSession } from '@/lib/session';

export default function AccountPage() {
  const { me } = useSession();
  const [values, setValues] = useState({ currentPassword: '', password: '' });
  const form = useForm(changePasswordSchema);
  return (
    <div className="space-y-6">
      <Section title="Your account">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Name</dt>
            <dd className="font-medium">{me.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="font-medium">{me.email}</dd>
          </div>
        </dl>
      </Section>
      <Section title="Change password" description="Changing it logs you out on every other device.">
        <form
          className="max-w-sm space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (await form.submit(values, '/me/password')) {
              toast.success('Password changed');
              setValues({ currentPassword: '', password: '' });
            }
          }}
        >
          <FormError message={form.formError} />
          <Field label="Current password" error={form.errors['currentPassword']}>
            {(p) => <PasswordInput {...p} autoComplete="current-password" value={values.currentPassword} onChange={(e) => setValues((v) => ({ ...v, currentPassword: e.target.value }))} />}
          </Field>
          <Field label="New password" hint="At least 10 characters." error={form.errors['password']}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />}
          </Field>
          <Button type="submit" disabled={form.pending || me.isDemo}>
            {form.pending ? 'Saving…' : 'Change password'}
          </Button>
          {me.isDemo ? <p className="text-sm text-muted-foreground">The demo password can’t be changed.</p> : null}
        </form>
      </Section>
    </div>
  );
}
