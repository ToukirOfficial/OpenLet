'use client';

import { useParams } from 'next/navigation';
import type { PropertyDetail } from '@openlet/shared';
import { PageHeader } from '@/components/app-shell';
import { PropertyForm } from '@/components/property-form';
import { ErrorState, ListSkeleton } from '@/components/states';
import { useApi } from '@/lib/use-api';

export default function EditPropertyPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<PropertyDetail>(`/properties/${id}`);
  return (
    <>
      <PageHeader title="Edit property" back={{ href: `/app/properties/${id}`, label: 'Back to property' }} />
      <div className="max-w-3xl">{error ? <ErrorState error={error} onRetry={reload} /> : data ? <PropertyForm property={data} /> : <ListSkeleton rows={6} />}</div>
    </>
  );
}
