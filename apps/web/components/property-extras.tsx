'use client';

import { Wrench } from 'lucide-react';
import { EmptyState } from '@/components/states';

/** Filled in by the repairs phase. */
export function PropertyRepairs({ propertyId: _propertyId }: { propertyId: string }) {
  return (
    <EmptyState icon={Wrench} title="No repairs yet">
      Repairs reported by tenants or logged by your team will be listed here.
    </EmptyState>
  );
}
