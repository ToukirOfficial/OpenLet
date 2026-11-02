'use client';

import { useSession } from '@/lib/session';

/** Shown on every page of the demo, so nobody mistakes the fake data for real. */
export function DemoBanner() {
  const { me } = useSession();
  if (!me.demoMode) return null;
  return (
    <div className="border-b border-brass/30 bg-brass-tint px-4 py-2 text-center text-sm text-slate">
      This is the OpenLet demo. Everything here is made up and resets every night.{' '}
      <a href="/demo/mail" className="font-semibold text-door underline underline-offset-2">
        See the emails it sent
      </a>
    </div>
  );
}
