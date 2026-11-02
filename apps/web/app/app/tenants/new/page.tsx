'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { Section } from '@/components/section';
import { TenantForm } from '@/components/tenant-form';

export default function NewTenantPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Add a tenant" back={{ href: '/app/tenants', label: 'Tenants' }} />
      <Section className="max-w-3xl">
        <TenantForm onSaved={(t) => router.push(`/app/tenants/${t.id}`)} />
      </Section>
    </>
  );
}
