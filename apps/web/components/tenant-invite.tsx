'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';

/** Invite (or re-invite) a tenant to their portal. Hidden once they use it. */
export function TenantPortalInvite({ tenant, onChange, size }: { tenant: { id: string; email: string | null; portal: 'NONE' | 'INVITED' | 'ACTIVE' }; onChange: () => void; size?: 'sm' | 'default' }) {
  const [pending, setPending] = useState(false);
  if (tenant.portal === 'ACTIVE') return null;
  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      title={tenant.email ? undefined : 'Add an email address first'}
      onClick={async () => {
        setPending(true);
        try {
          await api(`/tenants/${tenant.id}/invite`, { method: 'POST' });
          toast.success(`Portal invite sent to ${tenant.email}`);
          onChange();
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setPending(false);
        }
      }}
    >
      <Send className="size-4" /> {tenant.portal === 'INVITED' ? 'Resend portal invite' : 'Invite to portal'}
    </Button>
  );
}
