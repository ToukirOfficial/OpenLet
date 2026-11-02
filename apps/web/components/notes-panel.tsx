'use client';

import { useState } from 'react';
import { Lock, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, noteSchema, type NoteItem } from '@openlet/shared';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { useApi } from '@/lib/use-api';

type Owner = { propertyId?: string; tenancyId?: string; tenantId?: string };

/** Internal notes. Never shown to tenants. */
export function NotesPanel({ owner }: { owner: Owner }) {
  const query = new URLSearchParams(Object.entries(owner).filter(([, v]) => v) as [string, string][]).toString();
  const { data, error, loading, reload } = useApi<NoteItem[]>(`/notes?${query}`);
  const [body, setBody] = useState('');
  const form = useForm(noteSchema);
  return (
    <Section title="Internal notes" description="Only your team sees these. Tenants never do.">
      <form
        className="mb-5 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await form.submit({ body, ...owner }, '/notes')) {
            setBody('');
            await reload();
          }
        }}
      >
        <Textarea aria-label="New note" placeholder="Add a note for the team…" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        {form.formError || form.errors['body'] ? <p className="text-sm text-bad">{form.formError ?? form.errors['body']}</p> : null}
        <Button size="sm" type="submit" disabled={form.pending || !body.trim()}>
          <Lock className="size-3.5" /> Add internal note
        </Button>
      </form>
      {loading && !data ? (
        <ListSkeleton rows={2} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data!.length ? (
        <EmptyState icon={StickyNote} title="No notes yet">
          Keep useful details here: access codes, preferences, history.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data!.map((n) => (
            <li key={n.id} className="rounded-md border border-brass/25 bg-brass-tint/50 px-4 py-3">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {n.authorName} · {formatDateTime(n.createdAt)}
                </span>
                <button
                  className="hover:text-bad"
                  onClick={async () => {
                    try {
                      await api(`/notes/${n.id}`, { method: 'DELETE' });
                      await reload();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
