'use client';

import { useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { api, apiUrl, errorMessage } from '@/lib/api';

/** Workspace logo for tenant emails, the portal and PDFs. PNG or JPEG, metadata stripped by the API. */
export function LogoUpload({ hasLogo, workspaceId, onChange }: { hasLogo: boolean; workspaceId: string; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [v, setV] = useState(0);
  async function upload(file: File) {
    const body = new FormData();
    body.append('file', file);
    setPending(true);
    try {
      await api('/workspace/logo', { method: 'POST', body });
      toast.success('Logo updated');
      setV((x) => x + 1);
      onChange();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <Section title="Logo" description="Shown on PDFs and in the tenant portal. PNG or JPEG.">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-40 place-items-center overflow-hidden rounded-md border border-border bg-stone">
          {hasLogo ? (
            <img src={`${apiUrl(`/workspace-logo/${workspaceId}`)}?v=${v}`} alt="Workspace logo" className="max-h-14 max-w-36 object-contain" />
          ) : (
            <span className="text-sm text-muted-foreground">No logo yet</span>
          )}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <Button variant="outline" onClick={() => input.current?.click()} disabled={pending}>
          <ImageUp className="size-4" /> {pending ? 'Uploading…' : hasLogo ? 'Replace logo' : 'Upload logo'}
        </Button>
      </div>
    </Section>
  );
}
