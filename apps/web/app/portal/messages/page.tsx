'use client';

import { toast } from 'sonner';
import type { MessageItem } from '@openlet/shared';
import { MessageThread } from '@/components/message-thread';
import { ErrorState, ListSkeleton } from '@/components/states';
import { api, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';

export default function PortalMessagesPage() {
  const { tenancy } = useSession();
  const { data, error, loading, reload, setData } = useApi<{ tenancyId: string; messages: MessageItem[] }>('/portal/messages');
  return (
    <div className="space-y-5">
      <h1 className="text-title font-bold">Messages</h1>
      {loading && !data ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <MessageThread
          messages={data!.messages}
          placeholder={`Write to ${tenancy?.workspaceName}…`}
          emptyText={`Questions about your tenancy? Write to ${tenancy?.workspaceName} here. You’ll get an email when they reply.`}
          onSend={async (body) => {
            try {
              setData(await api<{ tenancyId: string; messages: MessageItem[] }>('/portal/messages', { method: 'POST', body: { body, tenancyId: data!.tenancyId } }));
              return true;
            } catch (e) {
              toast.error(errorMessage(e));
              return false;
            }
          }}
        />
      )}
    </div>
  );
}
