import type { WorkspaceRole } from './enums.js';
import type { WorkspaceSettingsInput } from './schemas.js';

/** API response shapes (DTOs). Only these fields ever leave the API. */

export interface Me {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
  workspaces: { id: string; name: string; role: WorkspaceRole }[];
  tenancies: { workspaceId: string; workspaceName: string; tenantId: string }[];
  canCreateWorkspace: boolean;
  demoMode: boolean;
}

export interface SetupStatus {
  setupNeeded: boolean;
  signupEnabled: boolean;
  demoMode: boolean;
}

export type LoginResult = { status: 'ok' } | { status: 'code'; challenge: string; email: string };

export interface InviteInfo {
  kind: 'MEMBER' | 'TENANT';
  workspaceName: string;
  email: string;
  role: WorkspaceRole | null;
  hasAccount: boolean;
}

export type WorkspaceSettings = Omit<WorkspaceSettingsInput, 'name' | 'contactEmail' | 'contactPhone' | 'address'>;

export interface CurrentWorkspace {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  hasLogo: boolean;
  role: WorkspaceRole;
  settings: WorkspaceSettings;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  isYou: boolean;
}
export interface TeamInvite {
  id: string;
  email: string;
  role: WorkspaceRole | null;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
}
export interface Team {
  members: TeamMember[];
  invites: TeamInvite[];
}

export interface AuditRow {
  id: string;
  action: string;
  targetType: string | null;
  who: string;
  ip: string | null;
  at: string;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  total?: number;
}
