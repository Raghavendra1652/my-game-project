export type AdminRole =
  | 'SUPER_ADMIN'
  | 'GAME_ADMIN'
  | 'SUPPORT_STAFF'
  | 'MODERATOR'
  | 'ANALYST';

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  status: 'active' | 'suspended';
  createdAt: number;
  lastLogin?: number;
  createdBy?: string;
}

export interface AdminPermissions {
  canViewDashboard: boolean;
  canSearchPlayers: boolean;
  canViewPlayerEmails: boolean;
  canViewPlayerUid: boolean;
  canAdjustCurrency: boolean;
  canManageShop: boolean;
  canManageEvents: boolean;
  canSuspendAccounts: boolean;
  canIssueCompensation: boolean;
  canManageStaff: boolean;
  canViewAuditLogs: boolean;
}

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  SUPER_ADMIN: {
    canViewDashboard: true,
    canSearchPlayers: true,
    canViewPlayerEmails: true,
    canViewPlayerUid: true,
    canAdjustCurrency: true,
    canManageShop: true,
    canManageEvents: true,
    canSuspendAccounts: true,
    canIssueCompensation: true,
    canManageStaff: true,
    canViewAuditLogs: true,
  },
  GAME_ADMIN: {
    canViewDashboard: true,
    canSearchPlayers: true,
    canViewPlayerEmails: true,
    canViewPlayerUid: true,
    canAdjustCurrency: true,
    canManageShop: true,
    canManageEvents: true,
    canSuspendAccounts: true,
    canIssueCompensation: true,
    canManageStaff: false,
    canViewAuditLogs: true,
  },
  SUPPORT_STAFF: {
    canViewDashboard: true,
    canSearchPlayers: true,
    canViewPlayerEmails: true,
    canViewPlayerUid: false,
    canAdjustCurrency: false,
    canManageShop: false,
    canManageEvents: false,
    canSuspendAccounts: false,
    canIssueCompensation: true, // Approved compensation actions only
    canManageStaff: false,
    canViewAuditLogs: false,
  },
  MODERATOR: {
    canViewDashboard: true,
    canSearchPlayers: true,
    canViewPlayerEmails: false,
    canViewPlayerUid: false,
    canAdjustCurrency: false,
    canManageShop: false,
    canManageEvents: false,
    canSuspendAccounts: true,
    canIssueCompensation: false,
    canManageStaff: false,
    canViewAuditLogs: false,
  },
  ANALYST: {
    canViewDashboard: true,
    canSearchPlayers: true,
    canViewPlayerEmails: false,
    canViewPlayerUid: false,
    canAdjustCurrency: false,
    canManageShop: false,
    canManageEvents: false,
    canSuspendAccounts: false,
    canIssueCompensation: false,
    canManageStaff: false,
    canViewAuditLogs: false,
  },
};

export interface PlayerAccount {
  uid: string;
  playerId: string; // TT-XXXXXX
  name: string;
  email?: string | null;
  av: string;
  points: number; // Coins
  diamonds: number;
  xp: number;
  level: number;
  title: string;
  wins: number;
  games: number;
  streak: number;
  best: number;
  status: 'active' | 'suspended';
  statusReason?: string;
  registeredAt: number;
  lastActive: number;
  owned: string[];
  history: any[];
  ach?: Record<string, number>;
  mis?: any;
  settings?: any;
  rawUid?: string;
  transactions?: CurrencyTransaction[];
}

export interface CurrencyTransaction {
  id: string;
  playerId: string;
  playerUid: string;
  playerName: string;
  currencyType: 'coins' | 'diamonds';
  action: 'add' | 'deduct';
  amount: number;
  previousBalance: number;
  newBalance: number;
  reason: string;
  adminUid: string;
  adminEmail: string;
  adminRole: AdminRole;
  idempotencyKey: string;
  timestamp: number;
  status: 'completed' | 'failed' | 'reversed';
}

export interface AuditLogItem {
  id: string;
  category: 'CURRENCY' | 'AUTH' | 'PLAYER' | 'SHOP' | 'EVENT' | 'STAFF' | 'REWARDS';
  action: string;
  adminUid: string;
  adminEmail: string;
  adminRole: string;
  targetId?: string;
  details: Record<string, any>;
  timestamp: number;
}

export interface DashboardStats {
  totalPlayers: number;
  activePlayers24h: number;
  activePlayers7d: number;
  totalMatches: number;
  totalCoinsCirculation: number;
  totalDiamondsCirculation: number;
  newRegistrationsToday: number;
  newRegistrations7d: number;
  recentTransactions: CurrencyTransaction[];
  recentAuditLogs: AuditLogItem[];
  playerGrowth: Array<{ date: string; players: number; active: number }>;
}

export interface ShopItem {
  id: string;
  name: string;
  symbol: string;
  category: string;
  coinPrice: number;
  diamondPrice: number;
  active: boolean;
  type: 'emoji' | 'symbol' | 'skin';
  description?: string;
  updatedAt: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  eventType: 'DOUBLE_COINS' | 'DIAMOND_RUSH' | 'TOURNAMENT' | 'WEEKEND_FRENZY' | 'SEASONAL';
  active: boolean;
  startTime: number;
  endTime: number;
  rewards: {
    coinMultiplier?: number;
    diamondBonus?: number;
    specialSymbol?: string;
    xpMultiplier?: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface CompensationRequest {
  playerId: string;
  playerUid: string;
  coins: number;
  diamonds: number;
  reason: string;
  giftItem?: string;
}
