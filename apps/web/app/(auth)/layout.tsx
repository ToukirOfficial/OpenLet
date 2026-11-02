import Link from 'next/link';
import { Logo } from '@/components/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" aria-label="OpenLet home" className="w-fit">
          <Logo />
        </Link>
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-xs text-muted-foreground">OpenLet is free, open-source software (AGPL-3.0).</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-door text-white lg:flex lg:flex-col lg:justify-end lg:p-12">
        <svg aria-hidden viewBox="0 0 28 32" className="absolute -top-16 -right-24 h-[34rem] w-auto opacity-[0.09]">
          <path d="M2 31V13C2 6.37 7.37 1 14 1s12 5.37 12 12v18H2Z" fill="#fff" />
        </svg>
        <blockquote className="relative max-w-md space-y-4">
          <p className="text-2xl leading-snug font-semibold">Rent, repairs and certificates for every property you let, in one place.</p>
          <p className="text-white/75">Your tenants get their own portal. Reminders go out on time. Nothing lives in a spreadsheet any more.</p>
        </blockquote>
      </aside>
    </div>
  );
}
