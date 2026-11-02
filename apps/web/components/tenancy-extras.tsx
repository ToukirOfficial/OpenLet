'use client';

import { RepairsFor } from '@/components/repair-list';
import { toast } from 'sonner';
import type { MessageItem, TenancyDetail } from '@openlet/shared';
import { MessageThread } from '@/components/message-thread';
import { Section } from '@/components/section';
import { ErrorState, ListSkeleton } from '@/components/states';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export { TenancyLedger } from './tenancy-ledger';
export function TenancyRepairs({ tenancy }: { tenancy: TenancyDetail }) {
  return <RepairsFor query={`propertyId=${tenancy.propertyId}`} emptyText="Repairs at this property will be listed here." newHref={`/app/repairs/new?propertyId=${tenancy.propertyId}`} />;
}
export function TenancyMessages({ tenancy }: { tenancy: TenancyDetail }) {
  const { data, error, reload, setData } = useApi<MessageItem[]>(`/tenancies/${tenancy.id}/messages`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <ListSkeleton rows={3} />;
  return (
    <Section title="Messages" description="Tenants see these in their portal and get an email for each one.">
      <MessageThread
        messages={data}
        placeholder={`Message ${tenancy.tenantNames}…`}
        emptyText="Start a conversation with the tenants. They can reply from their portal."
        onSend={async (body) => {
          try {
            setData(await api<MessageItem[]>(`/tenancies/${tenancy.id}/messages`, { method: 'POST', body: { body } }));
            return true;
          } catch (e) {
            toast.error(errorMessage(e));
            return false;
          }
        }}
      />
    </Section>
  );
}
