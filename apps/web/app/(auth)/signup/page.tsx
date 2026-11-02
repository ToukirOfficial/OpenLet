'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AccountForm } from '@/components/account-form';

export default function SignupPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo) {
    return (
      <div className="space-y-3">
        <h1 className="text-title font-bold">Check your email</h1>
        <p className="text-muted-foreground">
          Your workspace is ready. Log in with your email and password; we’ll send a code to <span className="font-semibold text-slate">{sentTo}</span> to confirm it’s you.
        </p>
        <Link href="/login" className="font-semibold text-door hover:underline">
          Go to log in
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-title font-bold">Create your workspace</h1>
        <p className="text-muted-foreground">Free for landlords and small agencies.</p>
      </div>
      <AccountForm path="/auth/signup" submitLabel="Create workspace" onCreated={setSentTo} />
      <p className="text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-door hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
