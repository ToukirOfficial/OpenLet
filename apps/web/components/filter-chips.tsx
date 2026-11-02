'use client';

import { cn } from '@/lib/utils';

/** A small set of mutually exclusive filters. */
export function FilterChips<T extends string>({ value, onChange, options, label }: { value: T | ''; onChange: (v: T | '') => void; options: { value: T | ''; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value || 'all'}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-9 rounded-full border border-border bg-paper px-3.5 text-sm font-medium text-slate/80 hover:border-line-strong', value === o.value && 'border-door bg-door text-white hover:border-door')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
