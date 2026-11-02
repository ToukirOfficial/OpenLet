'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Me } from '@openlet/shared';
import { api, ApiError, setWorkspace, storedWorkspace } from './api';

interface Session {
  me: Me;
  /** The workspace the staff app is showing (staff only). */
  workspace: Me['workspaces'][number] | null;
  /** The workspace the portal is showing (tenants only). */
  tenancy: Me['tenancies'][number] | null;
  switchWorkspace: (id: string) => void;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/**
 * Loads who is logged in. Sends people to /login when they aren't. `area` picks the workspace list the
 * page needs: staff memberships for /app, tenant records for /portal. This is for display only; the API
 * checks every request.
 */
export function SessionProvider({ area, children, fallback }: { area: 'app' | 'portal'; children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Me>('/me');
      const ids = area === 'app' ? data.workspaces.map((w) => w.id) : data.tenancies.map((t) => t.workspaceId);
      if (!ids.length) {
        // Wrong area for this account: staff go to /app, tenants to /portal.
        router.replace(area === 'app' ? (data.tenancies.length ? '/portal' : '/login?none=1') : data.workspaces.length ? '/app' : '/login?none=1');
        return;
      }
      const saved = storedWorkspace();
      const pick = saved && ids.includes(saved) ? saved : ids[0]!;
      setWorkspace(pick);
      setCurrent(pick);
      setMe(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/app';
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      } else throw e;
    }
  }, [area, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<Session | null>(() => {
    if (!me) return null;
    return {
      me,
      workspace: area === 'app' ? (me.workspaces.find((w) => w.id === current) ?? null) : null,
      tenancy: area === 'portal' ? (me.tenancies.find((t) => t.workspaceId === current) ?? null) : null,
      switchWorkspace: (id: string) => {
        setWorkspace(id);
        // A full reload so no data from the previous workspace stays on screen.
        window.location.assign(area === 'app' ? '/app' : '/portal');
      },
      reload: load,
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setWorkspace(null);
        window.location.assign('/login');
      },
    };
  }, [me, current, area, load]);

  if (!value) return <>{fallback}</>;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Hides controls a role can't use. The API refuses them anyway. */
export function useRole() {
  const { workspace } = useSession();
  const role = workspace?.role ?? 'STAFF';
  return { role, isOwner: role === 'OWNER', isManager: role === 'OWNER' || role === 'MANAGER' };
}
