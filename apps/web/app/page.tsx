import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ClipboardCheck, FileCode2, HardDrive, Users, Wrench } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand';
import { Tour } from '@/components/site/tour';
import { StatusBadge } from '@/components/status-badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'OpenLet: run your rentals without the spreadsheets',
  description: 'Free, open-source property and tenancy management for small landlords and letting agents. Rent tracking, repairs, certificates and a tenant portal. Self-host in one command.',
};

const DEMO = 'https://openlet.toukirahmedrony.com/demo';
const GITHUB = 'https://github.com/ToukirOfficial/OpenLet';

const FAQ = [
  ['Is it really free?', 'Yes. OpenLet is open-source software under the AGPL-3.0 licence. You install it on your own server and pay nothing per property, per tenant or per month.'],
  ['What do I need to run it?', 'A small Linux server (2 GB of memory is plenty) with Docker. Run docker compose up, open the address in your browser and create your account on the first screen. The README walks through email, backups and upgrades.'],
  ['Does it take rent payments?', 'No. OpenLet tracks rent: charges, payments you record, balances, arrears and reminders. Tenants keep paying by standing order or bank transfer as they do now.'],
  ['Is my data safe?', 'It lives on your own server. Files are private and only downloaded through permission checks, photo location data is removed, every query is limited to your workspace, and tenants only ever see their own tenancy.'],
  ['Does it keep me legally compliant?', 'It helps you stay on top of certificates, deposits and Right to Rent checks with reminders, but it isn’t legal advice. Landlords remain responsible for their legal duties.'],
  ['Can a letting agency use it with a team?', 'Yes. Invite Managers and Staff with their own logins and roles. One person can belong to several workspaces, for example two businesses.'],
] as const;

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="rounded-xl border border-border bg-paper p-5 shadow-[0_24px_60px_-30px_rgb(28_40_48/0.35)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">Needs attention</p>
          <span className="text-xs text-muted-foreground">Calder Valley Lettings</span>
        </div>
        <ul className="space-y-2.5 text-sm">
          {[
            ['£1,575.00 rent overdue', 'Ellie Brennan, 8 Mill Lane: 35 days late', 'bad'],
            ['Gas safety expired', '5 Beacon Close, since 21 October', 'bad'],
            ['New repair: black mould on bedroom wall', '#2, 8 Mill Lane', 'warn'],
            ['EICR expires in 21 days', '27 Weavers Row', 'warn'],
          ].map(([t, d, tone]) => (
            <li key={t} className="flex gap-3 rounded-lg border border-border/80 px-3 py-2.5">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${tone === 'bad' ? 'bg-bad' : 'bg-warn'}`} />
              <span>
                <span className="block font-semibold">{t}</span>
                <span className="text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-10 -left-4 w-52 rounded-[1.6rem] border-[6px] border-slate bg-stone p-3 shadow-[0_24px_50px_-20px_rgb(28_40_48/0.5)] sm:-left-10 lg:-left-16">
        <div className="mb-2 flex items-center gap-1.5">
          <LogoMark className="h-5" />
          <span className="text-[0.65rem] font-semibold">Tenant portal</span>
        </div>
        <div className="rounded-lg bg-door-tint px-3 py-2.5">
          <p className="text-[0.65rem] text-slate/70">Your balance</p>
          <p className="text-xl font-bold text-door">£0.00</p>
          <p className="text-[0.65rem]">All paid up. Thank you!</p>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-door py-2.5 text-[0.7rem] font-semibold text-white">
          <Wrench className="size-3" /> Report a repair
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-paper px-2.5 py-2 text-[0.65rem]">
          <span className="font-semibold">Boiler not working</span>
          <StatusBadge tone="info" className="px-1.5 text-[0.6rem]">
            Scheduled
          </StatusBadge>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-stone">
      <header className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5">
        <Link href="/" aria-label="OpenLet home">
          <Logo />
        </Link>
        <nav aria-label="Site" className="ml-auto hidden items-center gap-6 text-sm font-medium text-slate/80 md:flex">
          <a href="#tour" className="hover:text-door">
            What it does
          </a>
          <a href="#self-host" className="hover:text-door">
            Self-host
          </a>
          <a href="#faq" className="hover:text-door">
            Questions
          </a>
        </nav>
        <Button asChild variant="ghost" className="ml-auto md:ml-0">
          <Link href="/login">Log in</Link>
        </Button>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-8 pb-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-16">
          <div className="space-y-6">
            <h1 className="text-[2.6rem] leading-[1.05] font-bold tracking-[-0.025em] text-balance sm:text-[3.4rem]">Run your rentals without the spreadsheets.</h1>
            <p className="max-w-xl text-lg text-slate/80">
              Properties, tenants, rent, repairs, documents and certificates in one place, with a portal for your tenants. Free and open source, for landlords and small letting agents.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={DEMO}>Try the live demo</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={GITHUB}>
                  <FileCode2 className="size-4" /> View on GitHub
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Self-host in one command: <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[0.8rem] text-slate">docker compose up</code>
            </p>
          </div>
          <HeroVisual />
        </section>

        <section id="tour" className="border-t border-border bg-stone-deep/60 py-20">
          <div className="mx-auto max-w-6xl space-y-10 px-5">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl font-bold tracking-[-0.015em]">The five jobs it does every month</h2>
              <p className="text-lg text-slate/80">Each one works end to end, from the landlord’s desk to the tenant’s phone.</p>
            </div>
            <Tour />
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl space-y-10 px-5">
            <h2 className="text-3xl font-bold tracking-[-0.015em]">Who it’s for</h2>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                [Building2, 'Landlords with a few homes', 'One to a handful of properties, run in the evenings. See who has paid, what needs fixing and which certificate is next to expire.'],
                [Users, 'Small letting agencies', 'Up to about 50 properties and a small team. Owners, Managers and Staff each get the access they need, and tenants get their own portal.'],
                [HardDrive, 'People who install it', 'A developer or a technical friend setting it up on a small server. One Docker command, plain settings, backups and upgrades documented.'],
              ].map(([Icon, title, text]) => {
                const I = Icon as typeof Building2;
                return (
                  <div key={title as string} className="space-y-3 border-t-2 border-door pt-5">
                    <I className="size-6 text-door" aria-hidden />
                    <h3 className="text-lg font-bold">{title as string}</h3>
                    <p className="text-slate/80">{text as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="self-host" className="bg-slate py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-2 lg:items-center">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-[-0.015em]">Free and open source. Your server, your data.</h2>
              <p className="text-lg text-white/80">
                OpenLet is AGPL-3.0 software. There’s no subscription and no per-property fee. It runs on a small server you control, and you can export everything as CSV and files at any time.
              </p>
              <ul className="space-y-2 text-white/85">
                {['Web app, API, worker, PostgreSQL and Redis in one compose file', 'First visit creates your Owner account and workspace', 'Emails through your own SMTP provider'].map((t) => (
                  <li key={t} className="flex gap-2">
                    <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-black/30 p-6 font-mono text-sm leading-relaxed text-white/90">
              <code>
                {`git clone ${GITHUB}.git
cd OpenLet
cp .env.example .env   # set JWT_SECRET, APP_URL, SMTP
docker compose up -d

# then open your site and create your account`}
              </code>
            </pre>
          </div>
        </section>

        <section id="faq" className="py-20">
          <div className="mx-auto max-w-3xl space-y-8 px-5">
            <h2 className="text-3xl font-bold tracking-[-0.015em]">Questions</h2>
            <Accordion type="single" collapsible className="rounded-xl border border-border bg-paper px-5">
              {FAQ.map(([q, a]) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger className="text-base font-semibold">{q}</AccordionTrigger>
                  <AccordionContent className="text-slate/80">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={DEMO}>Try the live demo</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={GITHUB}>
                  <FileCode2 className="size-4" /> View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-sm text-muted-foreground">
          <Logo />
          <span>Free, open-source property management. AGPL-3.0.</span>
          <span className="ml-auto">Reminders are a helpful aid, not legal advice.</span>
        </div>
      </footer>
    </div>
  );
}
