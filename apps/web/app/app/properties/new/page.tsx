'use client';

import { PageHeader } from '@/components/app-shell';
import { PropertyForm } from '@/components/property-form';

export default function NewPropertyPage() {
  return (
    <>
      <PageHeader title="Add a property" back={{ href: '/app/properties', label: 'Properties' }} />
      <div className="max-w-3xl">
        <PropertyForm />
      </div>
    </>
  );
}
