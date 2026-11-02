'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SetupStatus } from '@openlet/shared';
import { AccountForm } from '@/components/account-form';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api<SetupStatus>('/setup')
      .then((s) => (s.setupNeeded ? setReady(true) : router.replace('/login')))
      .catch(() => setReady(true));
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-title font-bold">Set up OpenLet</h1>
        <p className="text-muted-foreground">Create the Owner account for this installation. You can invite your team and tenants afterwards.</p>
      </div>
      {ready ? <AccountForm path="/setup" submitLabel="Create my account" /> : <Skeleton className="h-80 w-full" />}
    </div>
  );
}
