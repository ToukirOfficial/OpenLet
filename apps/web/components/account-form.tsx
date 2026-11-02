'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setupSchema } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from '@/lib/form';

/** First-run setup and open sign-up share this form: you, your password, your business name. */
export function AccountForm({ path, submitLabel, onCreated }: { path: '/setup' | '/auth/signup'; submitLabel: string; onCreated?: (email: string) => void }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const form = useForm(setupSchema);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await form.submit<{ status: 'ok' | 'created'; email?: string }>(values, path);
    if (!res) return;
    if (res.status === 'created') onCreated?.(res.email ?? values.email);
    else router.replace('/app');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={form.formError} />
      <Field label="Your name" error={form.errors['name']}>
        {(p) => <Input {...p} autoComplete="name" value={values.name} onChange={set('name')} autoFocus />}
      </Field>
      <Field label="Email" error={form.errors['email']}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={values.email} onChange={set('email')} />}
      </Field>
      <Field label="Password" hint="At least 10 characters. A few unrelated words work well." error={form.errors['password']}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={set('password')} />}
      </Field>
      <Field label="Business or landlord name" hint="Tenants see this name on emails and in their portal." error={form.errors['workspaceName']}>
        {(p) => <Input {...p} autoComplete="organization" value={values.workspaceName} onChange={set('workspaceName')} placeholder="e.g. Calder Valley Lettings" />}
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={form.pending}>
        {form.pending ? 'Setting up…' : submitLabel}
      </Button>
    </form>
  );
}
