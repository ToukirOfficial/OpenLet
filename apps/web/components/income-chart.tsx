'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPence } from '@openlet/shared';

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const label = (m: string, long = false) => (long ? LONG : MONTH).format(new Date(`${m}-01T00:00:00Z`));
const short = (p: number) => (p >= 100_000 ? `£${Math.round(p / 100_000)}k` : `£${Math.round(p / 100)}`);

/** Rent received per month: one series, so no legend; the section title names it. A table is there for screen readers. */
export function IncomeChart({ data }: { data: { month: string; pence: number }[] }) {
  return (
    <figure>
      <div className="h-48" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
            <XAxis dataKey="month" tickFormatter={(m: string) => label(m)} tickLine={false} axisLine={false} tick={{ fill: 'var(--slate-soft)', fontSize: 12 }} />
            <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--slate-soft)', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'var(--stone)' }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as { month: string; pence: number } | undefined;
                if (!active || !row) return null;
                return (
                  <div className="rounded-md border border-border bg-paper px-3 py-2 text-sm shadow-sm">
                    <p className="text-muted-foreground">{label(row.month, true)}</p>
                    <p className="font-semibold tabular-nums">{formatPence(row.pence)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="pence" fill="var(--chart)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Rent received per month</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{label(d.month, true)}</th>
              <td>{formatPence(d.pence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
