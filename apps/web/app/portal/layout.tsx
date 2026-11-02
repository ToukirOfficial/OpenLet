'use client';

import { PortalShell } from '@/components/portal-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionProvider } from '@/lib/session';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      area="portal"
      fallback={
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-8" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <PortalShell>{children}</PortalShell>
    </SessionProvider>
  );
}
