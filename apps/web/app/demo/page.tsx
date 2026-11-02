'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Building2, Home, Mail } from 'lucide-react';
import { Logo } from '@/components/brand';
import { FormError } from '@/components/form-error';
import { setWorkspace, api, errorMessage } from '@/lib/api';

export default function DemoPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function go(as: 'landlord' | 'tenant') {
    setBusy(as);
    setError(null);
    try {
      setWorkspace(null);
      const res = await api<{ redirect: string }>(`/demo/login/${as}`, { method: 'POST' });
      window.location.assign(res.redirect);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-5 py-10">
      <Link href="/" aria-label="OpenLet home" className="w-fit">
        <Logo />
      </Link>
      <div className="space-y-2">
        <h1 className="text-display font-bold">Try OpenLet</h1>
        <p className="text-lg text-muted-foreground">A made-up letting agency with eight properties in West Yorkshire. Click around, record payments, report repairs. Everything resets every night.</p>
      </div>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={() => void go('landlord')} disabled={!!busy} className="group flex flex-col gap-3 rounded-xl border border-border bg-paper p-6 text-left transition-colors hover:border-door">
          <span className="grid size-12 place-items-center rounded-full bg-door text-white">
            <Building2 className="size-6" aria-hidden />
          </span>
          <span className="text-xl font-bold">{busy === 'landlord' ? 'Opening…' : 'Try as landlord'}</span>
          <span className="text-muted-foreground">The agency’s dashboard: rent, arrears, repairs, certificates and reports.</span>
        </button>
        <button onClick={() => void go('tenant')} disabled={!!busy} className="group flex flex-col gap-3 rounded-xl border border-border bg-paper p-6 text-left transition-colors hover:border-door">
          <span className="grid size-12 place-items-center rounded-full bg-brass text-white">
            <Home className="size-6" aria-hidden />
          </span>
          <span className="text-xl font-bold">{busy === 'tenant' ? 'Opening…' : 'Try as tenant'}</span>
          <span className="text-muted-foreground">Tom’s portal on his phone: balance, report a repair, documents and messages.</span>
        </button>
      </div>
      <Link href="/demo/mail" className="flex items-center gap-2 font-semibold text-door hover:underline">
        <Mail className="size-4" aria-hidden /> See the emails the demo has sent
      </Link>
    </main>
  );
}
