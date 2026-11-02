'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { formatDateTime, type MessageItem } from '@openlet/shared';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** A conversation, oldest at the top, with a box to reply. Your own messages sit on the right. */
export function MessageThread({ messages, onSend, placeholder, emptyText }: { messages: MessageItem[]; onSend: (body: string) => Promise<boolean>; placeholder: string; emptyText: string }) {
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [messages.length]);
  return (
    <div className="flex flex-col gap-4">
      {!messages.length ? (
        <EmptyState icon={MessageSquare} title="No messages yet">
          {emptyText}
        </EmptyState>
      ) : (
        <ol className="max-h-[60dvh] space-y-3 overflow-y-auto pr-1" aria-label="Messages">
          {messages.map((m) => (
            <li key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-xl px-4 py-2.5', m.mine ? 'rounded-br-sm bg-door text-white' : 'rounded-bl-sm border border-border bg-paper')}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn('mt-1 text-xs', m.mine ? 'text-white/75' : 'text-muted-foreground')}>
                  {m.mine ? 'You' : m.authorName} · {formatDateTime(m.createdAt)}
                </p>
              </div>
            </li>
          ))}
          <div ref={end} />
        </ol>
      )}
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setPending(true);
          if (await onSend(body)) setBody('');
          setPending(false);
        }}
      >
        <Textarea aria-label="Your message" rows={3} placeholder={placeholder} value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" size="lg" disabled={pending || !body.trim()}>
          <Send className="size-4" /> {pending ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
