'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** Search box that reports its value after the person stops typing. */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => text !== value && onChange(text), 250);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" aria-label={label} placeholder={placeholder} className="pl-9" value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}
