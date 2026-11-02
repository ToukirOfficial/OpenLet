import type { Me } from '@openlet/shared';
import { api } from './api';

/** Where to go after logging in: the page they came from, else the staff app, else the tenant portal. */
export async function destinationAfterLogin(next: string | null): Promise<string> {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  const me = await api<Me>('/me');
  if (me.workspaces.length) return '/app';
  if (me.tenancies.length) return '/portal';
  return '/login?none=1';
}
