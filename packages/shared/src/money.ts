/** Money is always integer pence, GBP. */
const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

/** 125000 → "£1,250.00" */
export function formatPence(pence: number | null | undefined): string {
  return pence === null || pence === undefined ? '—' : GBP.format(pence / 100);
}

/** "1,250.5" or "£1250.50" → 125050. Returns null when it isn't a valid amount. */
export function parsePounds(input: string): number | null {
  const clean = input.replace(/[£,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** 125050 → "1250.50" for form inputs. */
export const penceToInput = (pence: number) => (pence / 100).toFixed(2);
