'use client';

import { RepairsFor } from '@/components/repair-list';

export function PropertyRepairs({ propertyId }: { propertyId: string }) {
  return <RepairsFor query={`propertyId=${propertyId}`} emptyText="Repairs reported by tenants or logged by your team will be listed here." newHref={`/app/repairs/new?propertyId=${propertyId}`} />;
}
