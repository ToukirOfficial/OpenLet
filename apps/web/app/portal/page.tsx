'use client';

import { KeyRound } from 'lucide-react';
import { EmptyState } from '@/components/states';
import { useSession } from '@/lib/session';

export default function PortalHome() {
  const { me, tenancy } = useSession();
  return (
    <div className="space-y-6">
      <h1 className="text-title font-bold">Hello {me.name.split(' ')[0]}</h1>
      <EmptyState icon={KeyRound} title="Your tenancy will appear here">
        Once {tenancy?.workspaceName} sets up your tenancy, you’ll see your rent, repairs and documents here.
      </EmptyState>
    </div>
  );
}
