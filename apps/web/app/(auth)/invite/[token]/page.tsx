'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { acceptInviteSchema, ROLE_LABELS, type InviteInfo } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data: info, error, loading } = useApi<InviteInfo>(`/invites/${token}`);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const form = useForm(acceptInviteSchema);

  if (loading) return <Skeleton className="h-72 w-full" />;
  if (error || !info)
    return (
      <div className="space-y-4">
        <h1 className="text-title font-bold">This invite can’t be used</h1>
        <ErrorState error={error} />
        <Link href="/login" className="text-sm font-semibold text-door hover:underline">
          Go to log in
        </Link>
      </div>
    );

  const isTenant = info.kind === 'TENANT';
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const body = info.hasAccount ? { token, password } : { token, name, password };
        const res = await form.submit<{ kind: string; workspaceId: string }>(body, '/invites/accept');
        if (res) {
          try {
            localStorage.setItem('openlet.workspace', res.workspaceId);
          } catch {
            // ignore
          }
          router.replace(res.kind === 'TENANT' ? '/portal' : '/app');
        }
      }}
    >
      <div className="space-y-1.5">
        <h1 className="text-title font-bold">{isTenant ? `Your tenant portal with ${info.workspaceName}` : `Join ${info.workspaceName}`}</h1>
        <p className="text-muted-foreground">
          {isTenant
            ? 'See your rent, report repairs, read your documents and message your landlord or agent.'
            : `You’ve been invited as ${info.role ? ROLE_LABELS[info.role] : 'a team member'}.`}
        </p>
      </div>
      <FormError message={form.formError} />
      <div className="rounded-md border border-border bg-paper px-3 py-2 text-sm">
        <span className="text-muted-foreground">Email: </span>
        <span className="font-semibold">{info.email}</span>
      </div>
      {info.hasAccount ? (
        <Field label="Your OpenLet password" hint="You already have an account. Enter its password to accept." error={form.errors['password']}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />}
        </Field>
      ) : (
        <>
          <Field label="Your name" error={form.errors['name']}>
            {(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
          </Field>
          <Field label="Choose a password" hint="At least 10 characters." error={form.errors['password']}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        </>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={form.pending}>
        {form.pending ? 'Accepting…' : isTenant ? 'Open my portal' : 'Accept and continue'}
      </Button>
    </form>
  );
}
