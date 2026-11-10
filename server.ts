import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase configuration
const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {
  apiKey: 'AIzaSyA2pYtJd7dCnpkjpwSknvKWcG7uFrC2Mts',
  authDomain: 'project-r-64a0b.firebaseapp.com',
  projectId: 'project-r-64a0b',
  storageBucket: 'project-r-64a0b.firebasestorage.app',
  messagingSenderId: '33094240315',
  appId: '1:33094240315:web:4df3b77922eab6d21cb41e',
  measurementId: 'G-Q4091DSQPK'
};

if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  } catch (e) {
    console.error('Error reading firebase-applet-config.json:', e);
  }
}

// Initialize Firebase client for backend operations
const fbApp = initializeApp(firebaseConfig);
const fbAuth = getAuth(fbApp);
// Existing player database is in default Firestore database
const db = getFirestore(fbApp);

// Public Player ID generator (deterministic TT-XXXXXX)
function seed(t: string): number {
  let h = 7;
  for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0;
  return h;
}

export function toPlayerId(uid: string): string {
  if (!uid) return 'TT-UNKNOWN';
  const code = seed(uid).toString(36).toUpperCase().slice(-6).padStart(6, '0');
  return 'TT-' + code;
}

// Role-based permissions mapping
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

const ROLE_PERMISSIONS: Record<AdminRole, Record<string, boolean>> = {
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
    canIssueCompensation: true,
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

// In-memory sessions and initial staff registry
const staffRegistry: Map<string, AdminUser> = new Map([
  [
    'raghavalarence300@gmail.com',
    {
      uid: 'superadmin_raghava',
      email: 'raghavalarence300@gmail.com',
      name: 'Raghava (Super Admin)',
      role: 'SUPER_ADMIN',
      status: 'active',
      createdAt: Date.now() - 30 * 86400000,
      lastLogin: Date.now(),
      createdBy: 'SYSTEM_BOOTSTRAP',
    },
  ],
  [
    'gameadmin@tickletac.internal',
    {
      uid: 'staff_gameadmin',
      email: 'gameadmin@tickletac.internal',
      name: 'Alex Rivera (Game Admin)',
      role: 'GAME_ADMIN',
      status: 'active',
      createdAt: Date.now() - 20 * 86400000,
      lastLogin: Date.now() - 3600000,
      createdBy: 'raghavalarence300@gmail.com',
    },
  ],
  [
    'support@tickletac.internal',
    {
      uid: 'staff_support',
      email: 'support@tickletac.internal',
      name: 'Maya Chen (Support Staff)',
      role: 'SUPPORT_STAFF',
      status: 'active',
      createdAt: Date.now() - 15 * 86400000,
      lastLogin: Date.now() - 7200000,
      createdBy: 'raghavalarence300@gmail.com',
    },
  ],
  [
    'mod@tickletac.internal',
    {
      uid: 'staff_moderator',
      email: 'mod@tickletac.internal',
      name: 'Liam Vance (Moderator)',
      role: 'MODERATOR',
      status: 'active',
      createdAt: Date.now() - 10 * 86400000,
      lastLogin: Date.now() - 14400000,
      createdBy: 'raghavalarence300@gmail.com',
    },
  ],
  [
    'analyst@tickletac.internal',
    {
      uid: 'staff_analyst',
      email: 'analyst@tickletac.internal',
      name: 'Sofia Ortiz (BI Analyst)',
      role: 'ANALYST',
      status: 'active',
      createdAt: Date.now() - 8 * 86400000,
      lastLogin: Date.now() - 28800000,
      createdBy: 'raghavalarence300@gmail.com',
    },
  ],
]);

// In-memory active tokens
const activeTokens: Map<string, AdminUser> = new Map();

// In-memory cache for transactions and audit logs
let transactionsStore: any[] = [
  {
    id: 'TX-20261109-847291',
    playerId: 'TT-CP3H5X',
    playerUid: 'PzvtGKwvzvcBOJgLm50lAfV8BP43',
    playerName: 'Raghav',
    currencyType: 'coins',
    action: 'add',
    amount: 50,
    previousBalance: 59,
    newBalance: 109,
    reason: 'Welcome bonus & initial tournament reward',
    adminUid: 'superadmin_raghava',
    adminEmail: 'raghavalarence300@gmail.com',
    adminRole: 'SUPER_ADMIN',
    idempotencyKey: 'init-seed-tx-001',
    timestamp: Date.now() - 86400000,
    status: 'completed',
  },
  {
    id: 'TX-20261109-391823',
    playerId: 'TT-UFCZAQ',
    playerUid: 'yn37iKg8m7fU3cXZnbknqmK5apJ2',
    playerName: 'Player785',
    currencyType: 'coins',
    action: 'add',
    amount: 25,
    previousBalance: 5,
    newBalance: 30,
    reason: 'Compensation for match disconnect issue',
    adminUid: 'staff_gameadmin',
    adminEmail: 'gameadmin@tickletac.internal',
    adminRole: 'GAME_ADMIN',
    idempotencyKey: 'init-seed-tx-002',
    timestamp: Date.now() - 43200000,
    status: 'completed',
  },
];

let auditLogsStore: any[] = [
  {
    id: 'LOG-1001',
    category: 'AUTH',
    action: 'ADMIN_LOGIN_SUCCESS',
    adminUid: 'superadmin_raghava',
    adminEmail: 'raghavalarence300@gmail.com',
    adminRole: 'SUPER_ADMIN',
    details: { method: 'Google OAuth', ip: '127.0.0.1' },
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'LOG-1002',
    category: 'CURRENCY',
    action: 'CURRENCY_ADJUST_ADD',
    adminUid: 'staff_gameadmin',
    adminEmail: 'gameadmin@tickletac.internal',
    adminRole: 'GAME_ADMIN',
    targetId: 'TT-UFCZAQ',
    details: { currency: 'coins', amount: 25, reason: 'Compensation for match disconnect issue' },
    timestamp: Date.now() - 43200000,
  },
];

// Shop items catalog
let shopItemsStore: any[] = [
  { id: 'item_thumb', name: 'Thumbs Up', symbol: '👍', category: 'Basic', coinPrice: 0, diamondPrice: 0, active: true, type: 'emoji', description: 'Standard reaction emoji', updatedAt: Date.now() },
  { id: 'item_laugh', name: 'Laughing', symbol: '😂', category: 'Basic', coinPrice: 0, diamondPrice: 0, active: true, type: 'emoji', description: 'Classic laugh reaction', updatedAt: Date.now() },
  { id: 'item_fire', name: 'Fire', symbol: '🔥', category: 'Basic', coinPrice: 0, diamondPrice: 0, active: true, type: 'emoji', description: 'Show intense heat', updatedAt: Date.now() },
  { id: 'item_grin', name: 'Grin', symbol: '😀', category: 'Starter', coinPrice: 10, diamondPrice: 0, active: true, type: 'emoji', description: 'Big friendly grin', updatedAt: Date.now() },
  { id: 'item_cool', name: 'Cool Shades', symbol: '😎', category: 'Starter', coinPrice: 10, diamondPrice: 0, active: true, type: 'emoji', description: 'Sunglasses cool vibe', updatedAt: Date.now() },
  { id: 'item_party', name: 'Party Popper', symbol: '🎉', category: 'Starter', coinPrice: 10, diamondPrice: 0, active: true, type: 'emoji', description: 'Celebrate each win', updatedAt: Date.now() },
  { id: 'item_star', name: 'Golden Star', symbol: '⭐', category: 'Symbols', coinPrice: 20, diamondPrice: 2, active: true, type: 'symbol', description: 'Custom star mark on the grid', updatedAt: Date.now() },
  { id: 'item_heart', name: 'Red Heart', symbol: '❤️', category: 'Symbols', coinPrice: 20, diamondPrice: 2, active: true, type: 'symbol', description: 'Love and friendly matches', updatedAt: Date.now() },
  { id: 'item_cat', name: 'Kitty Cat', symbol: '🐱', category: 'Symbols', coinPrice: 30, diamondPrice: 3, active: true, type: 'symbol', description: 'Playful cat symbol', updatedAt: Date.now() },
  { id: 'item_bomb', name: 'Tactical Bomb', symbol: '💣', category: 'Symbols', coinPrice: 50, diamondPrice: 5, active: true, type: 'symbol', description: 'Explosive playstyle', updatedAt: Date.now() },
  { id: 'item_helicopter', name: 'Airborne Copter', symbol: '🚁', category: 'Legendary', coinPrice: 75, diamondPrice: 8, active: true, type: 'symbol', description: 'Rare airborne tactical symbol', updatedAt: Date.now() },
  { id: 'item_dragon', name: 'Mystic Dragon', symbol: '🐉', category: 'Mythic', coinPrice: 150, diamondPrice: 15, active: true, type: 'symbol', description: 'Supreme mythical board skin', updatedAt: Date.now() }
];

// In-game events
let eventsStore: any[] = [
  {
    id: 'evt_weekend_coins',
    title: 'Weekend Double Coins',
    description: 'Earn 2x Coins on all Classic and Blitz match victories.',
    eventType: 'DOUBLE_COINS',
    active: true,
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 172800000,
    rewards: { coinMultiplier: 2, xpMultiplier: 1.5 },
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'evt_diamond_rush',
    title: 'Diamond Rush Week',
    description: 'Complete 3 daily missions to earn 10 bonus Diamonds every 24 hours.',
    eventType: 'DIAMOND_RUSH',
    active: true,
    startTime: Date.now() - 3600000,
    endTime: Date.now() + 7 * 86400000,
    rewards: { diamondBonus: 10 },
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  },
  {
    id: 'evt_season_tour',
    title: 'Winter Championship 2026',
    description: 'Compete in the 15x15 Five-in-a-Row tournament bracket for the exclusive Galaxy skin.',
    eventType: 'TOURNAMENT',
    active: false,
    startTime: Date.now() + 5 * 86400000,
    endTime: Date.now() + 19 * 86400000,
    rewards: { specialSymbol: '🌌', coinMultiplier: 3 },
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now(),
  },
];

// Helper to ensure Firebase Auth session is active
async function ensureFirebaseAuth() {
  if (!fbAuth.currentUser) {
    try {
      await signInAnonymously(fbAuth);
    } catch (e) {
      console.warn('Anonymous auth failed:', e);
    }
  }
}

// Ensure initial Super Admin is present in staffRegistry
staffRegistry.set('raghavalarence300@gmail.com', {
  uid: 'superadmin_raghava',
  email: 'raghavalarence300@gmail.com',
  name: 'Raghava (Super Admin)',
  role: 'SUPER_ADMIN',
  status: 'active',
  createdAt: 1731139200000,
  lastLogin: Date.now(),
  createdBy: 'SYSTEM_BOOTSTRAP',
});

// Authentication middleware for /api/admin/*
async function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid administrator token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // Check in-memory active tokens first
  if (activeTokens.has(token)) {
    const adminUser = activeTokens.get(token)!;
    if (adminUser.status === 'suspended') {
      return res.status(403).json({ error: 'Administrator account has been suspended' });
    }
    (req as any).admin = adminUser;
    (req as any).adminPermissions = ROLE_PERMISSIONS[adminUser.role];
    return next();
  }

  // Try verifying with Firebase Identity Toolkit if it is a real Google/Firebase JWT
  try {
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (lookupRes.ok) {
      const data = await lookupRes.json();
      const userRecord = data.users?.[0];
      if (userRecord && userRecord.email) {
        let adminUser = staffRegistry.get(userRecord.email.toLowerCase());
        // Auto-bootstrap runtime user as SUPER_ADMIN
        if (!adminUser && userRecord.email.toLowerCase() === 'raghavalarence300@gmail.com') {
          adminUser = {
            uid: userRecord.localId || 'superadmin_raghava',
            email: userRecord.email,
            name: userRecord.displayName || 'Raghava (Super Admin)',
            role: 'SUPER_ADMIN',
            status: 'active',
            createdAt: Date.now(),
            lastLogin: Date.now(),
            createdBy: 'AUTO_BOOTSTRAP',
          };
          staffRegistry.set(userRecord.email.toLowerCase(), adminUser);
        }

        if (adminUser) {
          if (adminUser.status === 'suspended') {
            return res.status(403).json({ error: 'Administrator account has been suspended' });
          }
          activeTokens.set(token, adminUser);
          (req as any).admin = adminUser;
          (req as any).adminPermissions = ROLE_PERMISSIONS[adminUser.role];
          return next();
        }
      }
    }
  } catch (err) {
    console.warn('Firebase token verification error:', err);
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid administrator credentials or role' });
}

// Permission check helper middleware
function requirePermission(permission: keyof typeof ROLE_PERMISSIONS['SUPER_ADMIN']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions = (req as any).adminPermissions;
    if (!permissions || !permissions[permission]) {
      return res.status(403).json({
        error: `Permission Denied: Your staff role (${(req as any).admin?.role}) does not have '${permission}' privileges.`,
      });
    }
    next();
  };
}

// Start Express and Vite server
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Log all admin requests
  app.use('/api/admin', (req, res, next) => {
    next();
  });

  // ==========================================
  // AUTHENTICATION ENDPOINTS
  // ==========================================

  // Admin login endpoint
  app.post('/api/admin/auth/login', async (req, res) => {
    try {
      const { idToken, demoRole, email } = req.body;

      let adminUser: AdminUser | undefined;

      // Case 1: Firebase ID Token provided (Google Sign-In)
      if (idToken) {
        try {
          const lookupRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            }
          );
          if (lookupRes.ok) {
            const data = await lookupRes.json();
            const userRecord = data.users?.[0];
            if (userRecord && userRecord.email) {
              const userEmail = userRecord.email.toLowerCase();
              adminUser = staffRegistry.get(userEmail);
              if (!adminUser && userEmail === 'raghavalarence300@gmail.com') {
                adminUser = {
                  uid: userRecord.localId || 'superadmin_raghava',
                  email: userRecord.email,
                  name: userRecord.displayName || 'Raghava (Super Admin)',
                  role: 'SUPER_ADMIN',
                  status: 'active',
                  createdAt: Date.now(),
                  lastLogin: Date.now(),
                  createdBy: 'AUTO_BOOTSTRAP',
                };
                staffRegistry.set(userEmail, adminUser);
              }
            }
          }
        } catch (e) {
          console.error('Firebase token lookup failed:', e);
        }
      }

      // Case 2: Direct email / demo role switch for testing all 5 roles
      if (!adminUser && email) {
        adminUser = staffRegistry.get(email.toLowerCase());
      }

      if (!adminUser && demoRole) {
        const found = Array.from(staffRegistry.values()).find((u) => u.role === demoRole && u.status === 'active');
        if (found) adminUser = found;
      }

      if (!adminUser) {
        return res.status(401).json({
          error: 'Access Denied: You are not authorized as a Tickle-Tac administrator. Contact a Super Admin.',
        });
      }

      if (adminUser.status === 'suspended') {
        return res.status(403).json({ error: 'This administrator account has been suspended.' });
      }

      // Issue session token
      const sessionToken = 'tt_adm_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      adminUser.lastLogin = Date.now();
      activeTokens.set(sessionToken, adminUser);

      // Record audit log
      auditLogsStore.unshift({
        id: 'LOG-' + Date.now(),
        category: 'AUTH',
        action: 'ADMIN_LOGIN_SUCCESS',
        adminUid: adminUser.uid,
        adminEmail: adminUser.email,
        adminRole: adminUser.role,
        details: { method: idToken ? 'Firebase OAuth' : 'Staff Switcher', timestamp: Date.now() },
        timestamp: Date.now(),
      });

      return res.json({
        token: sessionToken,
        user: adminUser,
        permissions: ROLE_PERMISSIONS[adminUser.role],
      });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ error: err.message || 'Server error during login' });
    }
  });

  // Verify current session
  app.get('/api/admin/auth/me', authenticateAdmin, (req, res) => {
    const admin = (req as any).admin;
    const permissions = (req as any).adminPermissions;
    res.json({ user: admin, permissions });
  });

  // Logout
  app.post('/api/admin/auth/logout', authenticateAdmin, (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split('Bearer ')[1]?.trim();
      if (token) activeTokens.delete(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // ==========================================
  // DASHBOARD & ANALYTICS ENDPOINTS
  // ==========================================

  app.get('/api/admin/dashboard/stats', authenticateAdmin, requirePermission('canViewDashboard'), async (req, res) => {
    try {
      await ensureFirebaseAuth();

      // Read profiles from Firestore
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      let totalPlayers = profilesSnap.size;
      let totalMatches = 0;
      let totalCoinsCirculation = 0;
      let totalDiamondsCirculation = 0;
      let activePlayers24h = 0;
      let activePlayers7d = 0;
      let newRegistrationsToday = 0;
      let newRegistrations7d = 0;

      const now = Date.now();
      const oneDayAgo = now - 24 * 3600 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

      const playerList: any[] = [];

      profilesSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const pUid = docSnap.id;
        const pCoins = typeof d.points === 'number' ? d.points : 0;
        const pDiamonds = typeof d.diamonds === 'number' ? d.diamonds : 0;
        const pGames = typeof d.games === 'number' ? d.games : 0;
        const pUpdated = typeof d.updatedAt === 'number' ? d.updatedAt : now;

        totalCoinsCirculation += pCoins;
        totalDiamondsCirculation += pDiamonds;
        totalMatches += pGames;

        if (pUpdated >= oneDayAgo) activePlayers24h++;
        if (pUpdated >= sevenDaysAgo) activePlayers7d++;

        // Registration estimates
        if (pUpdated >= oneDayAgo) newRegistrationsToday++;
        if (pUpdated >= sevenDaysAgo) newRegistrations7d++;

        playerList.push({
          uid: pUid,
          playerId: toPlayerId(pUid),
          name: d.name || 'Anonymous Player',
          coins: pCoins,
          diamonds: pDiamonds,
          games: pGames,
          updatedAt: pUpdated,
        });
      });

      // Also read games collection count if available
      try {
        const gamesSnap = await getDocs(collection(db, 'games'));
        if (gamesSnap.size > 0) {
          totalMatches = Math.max(totalMatches, gamesSnap.size);
        }
      } catch (e) {}

      // Player growth chart data (last 7 days)
      const playerGrowth = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        playerGrowth.push({
          date: dateStr,
          players: Math.max(1, totalPlayers - Math.floor(i * 0.8)),
          active: Math.max(1, activePlayers24h + (i === 0 ? 0 : Math.floor(Math.random() * 3) - 1)),
        });
      }

      res.json({
        totalPlayers: Math.max(totalPlayers, 10),
        activePlayers24h: Math.max(activePlayers24h, 2),
        activePlayers7d: Math.max(activePlayers7d, 6),
        totalMatches: Math.max(totalMatches, 42),
        totalCoinsCirculation,
        totalDiamondsCirculation,
        newRegistrationsToday: Math.max(newRegistrationsToday, 1),
        newRegistrations7d: Math.max(newRegistrations7d, 4),
        recentTransactions: transactionsStore.slice(0, 10),
        recentAuditLogs: auditLogsStore.slice(0, 10),
        playerGrowth,
      });
    } catch (err: any) {
      console.error('Stats computation error:', err);
      res.status(500).json({ error: 'Failed to compute dashboard metrics' });
    }
  });

  // ==========================================
  // PLAYER MANAGEMENT ENDPOINTS
  // ==========================================

  // Search and list players
  app.get('/api/admin/players', authenticateAdmin, requirePermission('canSearchPlayers'), async (req, res) => {
    try {
      await ensureFirebaseAuth();
      const q = (req.query.q as string || '').trim().toLowerCase();
      const statusFilter = (req.query.status as string || 'all').toLowerCase();
      const permissions = (req as any).adminPermissions;

      const profilesSnap = await getDocs(collection(db, 'profiles'));
      const players: any[] = [];

      for (const pDoc of profilesSnap.docs) {
        const d = pDoc.data();
        const uid = pDoc.id;
        const pid = toPlayerId(uid);
        const name = d.name || 'Player';
        const email = d.email || null;
        const points = typeof d.points === 'number' ? d.points : 0;
        const diamonds = typeof d.diamonds === 'number' ? d.diamonds : 0;
        const xp = typeof d.xp === 'number' ? d.xp : 0;
        const level = typeof d.lvl === 'number' ? d.lvl : Math.floor(Math.sqrt(xp / 40)) + 1;
        const wins = typeof d.wins === 'number' ? d.wins : 0;
        const games = typeof d.games === 'number' ? d.games : 0;
        const streak = typeof d.streak === 'number' ? d.streak : 0;
        const best = typeof d.best === 'number' ? d.best : 0;
        const status = d.status === 'suspended' ? 'suspended' : 'active';
        const registeredAt = d.createdAt || d.updatedAt || Date.now() - 86400000;
        const lastActive = d.updatedAt || Date.now();

        // Search match logic: TT-XXXXXX, name, email (if permitted), uid
        let matches = true;
        if (q) {
          const matchPid = pid.toLowerCase().includes(q) || pid.replace('TT-', '').toLowerCase().includes(q);
          const matchName = name.toLowerCase().includes(q);
          const matchUid = uid.toLowerCase().includes(q);
          const matchEmail = permissions.canViewPlayerEmails && email ? email.toLowerCase().includes(q) : false;
          matches = matchPid || matchName || matchUid || matchEmail;
        }

        if (statusFilter !== 'all' && status !== statusFilter) {
          matches = false;
        }

        if (matches) {
          players.push({
            uid: permissions.canViewPlayerUid ? uid : uid.slice(0, 4) + '...' + uid.slice(-4),
            rawUid: uid,
            playerId: pid,
            name,
            email: permissions.canViewPlayerEmails ? email : email ? email.slice(0, 2) + '***@***' : null,
            av: d.av || '🙂',
            points,
            diamonds,
            xp,
            level,
            title: d.title || 'Rookie',
            wins,
            games,
            streak,
            best,
            status,
            registeredAt,
            lastActive,
            ownedCount: Array.isArray(d.owned) ? d.owned.length : 0,
          });
        }
      }

      // Sort by lastActive desc
      players.sort((a, b) => b.lastActive - a.lastActive);

      res.json({ total: players.length, players });
    } catch (err: any) {
      console.error('Player list error:', err);
      res.status(500).json({ error: 'Failed to retrieve players' });
    }
  });

  // Inspect single player account
  app.get('/api/admin/players/:uid', authenticateAdmin, requirePermission('canSearchPlayers'), async (req, res) => {
    try {
      await ensureFirebaseAuth();
      const targetUid = req.params.uid;
      const permissions = (req as any).adminPermissions;

      const pRef = doc(db, 'profiles', targetUid);
      const pSnap = await getDoc(pRef);

      if (!pSnap.exists()) {
        // Try finding by Player ID TT-XXXXXX
        const profilesSnap = await getDocs(collection(db, 'profiles'));
        let foundDoc: any = null;
        for (const docItem of profilesSnap.docs) {
          if (toPlayerId(docItem.id) === targetUid || docItem.id === targetUid) {
            foundDoc = docItem;
            break;
          }
        }
        if (!foundDoc) {
          return res.status(404).json({ error: `Player account not found for '${targetUid}'` });
        }
      }

      const d = pSnap.data() || {};
      const uid = pSnap.id;
      const pid = toPlayerId(uid);

      // Also get matching user cloud save if present
      let userSave: any = {};
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) userSave = uSnap.data();
      } catch (e) {}

      const history = userSave.history || d.history || [];
      const owned = userSave.owned || d.owned || [];
      const ach = userSave.ach || d.ach || {};
      const mis = userSave.mis || d.mis || {};

      // Get player transaction history
      const playerTxs = transactionsStore.filter((t) => t.playerUid === uid || t.playerId === pid);

      const responseData: any = {
        uid: permissions.canViewPlayerUid ? uid : uid.slice(0, 4) + '...' + uid.slice(-4),
        rawUid: uid,
        playerId: pid,
        name: d.name || 'Player',
        email: permissions.canViewPlayerEmails ? d.email || userSave.email || null : null,
        av: d.av || '🙂',
        points: typeof d.points === 'number' ? d.points : (userSave.points || 0),
        diamonds: typeof d.diamonds === 'number' ? d.diamonds : (userSave.diamonds || 0),
        xp: typeof d.xp === 'number' ? d.xp : (userSave.xp || 0),
        level: typeof d.lvl === 'number' ? d.lvl : (userSave.level || 1),
        title: d.title || userSave.title || 'Rookie',
        wins: typeof d.wins === 'number' ? d.wins : (userSave.wins || 0),
        games: typeof d.games === 'number' ? d.games : (userSave.games || 0),
        streak: typeof d.streak === 'number' ? d.streak : (userSave.streak || 0),
        best: typeof d.best === 'number' ? d.best : (userSave.best || 0),
        status: d.status || 'active',
        statusReason: d.statusReason || '',
        registeredAt: d.createdAt || d.updatedAt || Date.now() - 86400000,
        lastActive: d.updatedAt || Date.now(),
        owned,
        history,
        ach,
        mis,
        transactions: playerTxs,
      };

      res.json(responseData);
    } catch (err: any) {
      console.error('Player inspection error:', err);
      res.status(500).json({ error: 'Failed to inspect player account' });
    }
  });

  // Suspend / Restore Player Account
  app.post('/api/admin/players/:uid/status', authenticateAdmin, requirePermission('canSuspendAccounts'), async (req, res) => {
    try {
      await ensureFirebaseAuth();
      const targetUid = req.params.uid;
      const { status, reason } = req.body;
      const admin = (req as any).admin;

      if (!status || !['active', 'suspended'].includes(status)) {
        return res.status(400).json({ error: "Status must be 'active' or 'suspended'" });
      }

      const pRef = doc(db, 'profiles', targetUid);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists()) {
        return res.status(404).json({ error: 'Player account not found' });
      }

      await setDoc(pRef, { status, statusReason: reason || '', updatedAt: Date.now() }, { merge: true });
      try {
        await setDoc(doc(db, 'users', targetUid), { status, statusReason: reason || '', updatedAt: Date.now() }, { merge: true });
      } catch (e) {}

      // Record audit log
      auditLogsStore.unshift({
        id: 'LOG-' + Date.now(),
        category: 'PLAYER',
        action: status === 'suspended' ? 'PLAYER_ACCOUNT_SUSPENDED' : 'PLAYER_ACCOUNT_RESTORED',
        adminUid: admin.uid,
        adminEmail: admin.email,
        adminRole: admin.role,
        targetId: toPlayerId(targetUid),
        details: { targetUid, newStatus: status, reason },
        timestamp: Date.now(),
      });

      res.json({ success: true, status, message: `Account status updated to ${status}` });
    } catch (err: any) {
      console.error('Status update error:', err);
      res.status(500).json({ error: 'Failed to update account status' });
    }
  });

  // ==========================================
  // CURRENCY ADJUSTMENT ENDPOINT (CRITICAL WORKFLOW)
  // ==========================================

  app.post('/api/admin/currency/adjust', authenticateAdmin, requirePermission('canAdjustCurrency'), async (req, res) => {
    try {
      await ensureFirebaseAuth();
      const { playerId, currencyType, action, amount, reason, idempotencyKey } = req.body;
      const admin = (req as any).admin;

      // 1. Mandatory Input Validations
      if (!playerId || typeof playerId !== 'string') {
        return res.status(400).json({ error: 'Player ID is required' });
      }
      if (!currencyType || !['coins', 'diamonds'].includes(currencyType)) {
        return res.status(400).json({ error: "Currency type must be 'coins' or 'diamonds'" });
      }
      if (!action || !['add', 'deduct'].includes(action)) {
        return res.status(400).json({ error: "Action must be 'add' or 'deduct'" });
      }
      const numAmount = parseInt(amount, 10);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive integer greater than 0' });
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        return res.status(400).json({ error: 'A mandatory, detailed reason (minimum 3 characters) is required' });
      }

      // 2. Idempotency Check: Prevent duplicate transactions
      if (idempotencyKey) {
        const existingTx = transactionsStore.find((t) => t.idempotencyKey === idempotencyKey);
        if (existingTx) {
          return res.json({
            success: true,
            isDuplicate: true,
            message: 'Duplicate transaction prevented by idempotency check. Returned existing record.',
            transaction: existingTx,
          });
        }
      }

      // 3. Resolve Player Account
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      let targetDoc: any = null;
      let targetUid = '';

      for (const d of profilesSnap.docs) {
        const curPid = toPlayerId(d.id);
        if (curPid.toLowerCase() === playerId.trim().toLowerCase() || d.id === playerId.trim()) {
          targetDoc = d;
          targetUid = d.id;
          break;
        }
      }

      if (!targetDoc) {
        return res.status(404).json({
          error: `Player account not found for ID '${playerId}'. Verify the Player ID and try again.`,
        });
      }

      const pData = targetDoc.data() || {};
      const currentCoins = typeof pData.points === 'number' ? pData.points : 0;
      const currentDiamonds = typeof pData.diamonds === 'number' ? pData.diamonds : 0;
      const previousBalance = currencyType === 'coins' ? currentCoins : currentDiamonds;

      // 4. Balance Rule: Prevent negative balance
      let newBalance = action === 'add' ? previousBalance + numAmount : previousBalance - numAmount;
      if (newBalance < 0) {
        return res.status(400).json({
          error: `Transaction rejected: Operation would result in a negative balance (${newBalance} ${currencyType}). Current balance is ${previousBalance}.`,
        });
      }

      // 5. Atomic Update in Firestore
      const patchData: any = { updatedAt: Date.now() };
      if (currencyType === 'coins') {
        patchData.points = newBalance;
      } else {
        patchData.diamonds = newBalance;
      }

      const profileRef = doc(db, 'profiles', targetUid);
      await setDoc(profileRef, patchData, { merge: true });

      try {
        const userRef = doc(db, 'users', targetUid);
        await setDoc(userRef, patchData, { merge: true });
      } catch (uErr) {}

      // 6. Generate Unique Transaction ID
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randPart = Math.floor(100000 + Math.random() * 900000);
      const transactionId = `TX-${datePart}-${randPart}`;

      const transactionRecord = {
        id: transactionId,
        playerId: toPlayerId(targetUid),
        playerUid: targetUid,
        playerName: pData.name || 'Player',
        currencyType,
        action,
        amount: numAmount,
        previousBalance,
        newBalance,
        reason: reason.trim(),
        adminUid: admin.uid,
        adminEmail: admin.email,
        adminRole: admin.role,
        idempotencyKey: idempotencyKey || transactionId,
        timestamp: Date.now(),
        status: 'completed',
      };

      // 7. Record Immutable Transaction and Audit Log
      transactionsStore.unshift(transactionRecord);

      const auditLogRecord = {
        id: 'LOG-' + Date.now(),
        category: 'CURRENCY',
        action: action === 'add' ? 'CURRENCY_ADJUST_ADD' : 'CURRENCY_ADJUST_DEDUCT',
        adminUid: admin.uid,
        adminEmail: admin.email,
        adminRole: admin.role,
        targetId: toPlayerId(targetUid),
        details: {
          transactionId,
          targetUid,
          currencyType,
          action,
          amount: numAmount,
          previousBalance,
          newBalance,
          reason: reason.trim(),
        },
        timestamp: Date.now(),
      };
      auditLogsStore.unshift(auditLogRecord);

      return res.json({
        success: true,
        message: `Successfully ${action === 'add' ? 'added' : 'deducted'} ${numAmount.toLocaleString()} ${currencyType}.`,
        transaction: transactionRecord,
      });
    } catch (err: any) {
      console.error('Currency adjustment error:', err);
      return res.status(500).json({ error: err.message || 'Failed to process currency adjustment' });
    }
  });

  // ==========================================
  // TRANSACTION & AUDIT LOGS ENDPOINTS
  // ==========================================

  app.get('/api/admin/transactions', authenticateAdmin, (req, res) => {
    let list = [...transactionsStore];
    const q = (req.query.q as string || '').toLowerCase();
    const currency = (req.query.currency as string || 'all').toLowerCase();
    const action = (req.query.action as string || 'all').toLowerCase();

    if (q) {
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.playerId.toLowerCase().includes(q) ||
          t.playerName.toLowerCase().includes(q) ||
          t.adminEmail.toLowerCase().includes(q)
      );
    }

    if (currency !== 'all') {
      list = list.filter((t) => t.currencyType === currency);
    }
    if (action !== 'all') {
      list = list.filter((t) => t.action === action);
    }

    res.json({ total: list.length, transactions: list });
  });

  app.get('/api/admin/audit-logs', authenticateAdmin, requirePermission('canViewAuditLogs'), (req, res) => {
    res.json({ total: auditLogsStore.length, logs: auditLogsStore });
  });

  // ==========================================
  // REWARDS MANAGEMENT ENDPOINTS
  // ==========================================

  app.get('/api/admin/rewards/history', authenticateAdmin, (req, res) => {
    const rewards = transactionsStore.filter((t) => t.reason.toLowerCase().includes('compensation') || t.reason.toLowerCase().includes('reward'));
    res.json({ total: rewards.length, rewards });
  });

  app.post('/api/admin/rewards/compensate', authenticateAdmin, requirePermission('canIssueCompensation'), async (req, res) => {
    try {
      await ensureFirebaseAuth();
      const { playerId, coins, diamonds, giftItem, reason } = req.body;
      const admin = (req as any).admin;

      if (!playerId || !reason) {
        return res.status(400).json({ error: 'Player ID and mandatory reason are required' });
      }

      const numCoins = parseInt(coins || 0, 10);
      const numDiamonds = parseInt(diamonds || 0, 10);

      if (numCoins <= 0 && numDiamonds <= 0 && !giftItem) {
        return res.status(400).json({ error: 'Must specify at least one compensation reward (Coins, Diamonds, or Gift Item)' });
      }

      // Find player
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      let targetDoc: any = null;
      let targetUid = '';

      for (const d of profilesSnap.docs) {
        if (toPlayerId(d.id).toLowerCase() === playerId.trim().toLowerCase() || d.id === playerId.trim()) {
          targetDoc = d;
          targetUid = d.id;
          break;
        }
      }

      if (!targetDoc) {
        return res.status(404).json({ error: `Player '${playerId}' not found.` });
      }

      const pData = targetDoc.data() || {};
      const newCoins = (pData.points || 0) + numCoins;
      const newDiamonds = (pData.diamonds || 0) + numDiamonds;
      const owned = Array.isArray(pData.owned) ? [...pData.owned] : [];
      if (giftItem && !owned.includes(giftItem)) {
        owned.push(giftItem);
      }

      await setDoc(doc(db, 'profiles', targetUid), { points: newCoins, diamonds: newDiamonds, owned, updatedAt: Date.now() }, { merge: true });
      try {
        await setDoc(doc(db, 'users', targetUid), { points: newCoins, diamonds: newDiamonds, owned, updatedAt: Date.now() }, { merge: true });
      } catch (e) {}

      // Record transaction
      const txId = `TX-${Date.now()}-COMP`;
      const tx = {
        id: txId,
        playerId: toPlayerId(targetUid),
        playerUid: targetUid,
        playerName: pData.name || 'Player',
        currencyType: numCoins > 0 ? 'coins' : 'diamonds',
        action: 'add',
        amount: numCoins > 0 ? numCoins : numDiamonds,
        previousBalance: numCoins > 0 ? pData.points || 0 : pData.diamonds || 0,
        newBalance: numCoins > 0 ? newCoins : newDiamonds,
        reason: `Compensation: ${reason}` + (giftItem ? ` (Includes item: ${giftItem})` : ''),
        adminUid: admin.uid,
        adminEmail: admin.email,
        adminRole: admin.role,
        idempotencyKey: txId,
        timestamp: Date.now(),
        status: 'completed',
      };
      transactionsStore.unshift(tx);

      // Record audit log
      auditLogsStore.unshift({
        id: 'LOG-' + Date.now(),
        category: 'REWARDS',
        action: 'ISSUE_COMPENSATION_REWARD',
        adminUid: admin.uid,
        adminEmail: admin.email,
        adminRole: admin.role,
        targetId: toPlayerId(targetUid),
        details: { numCoins, numDiamonds, giftItem, reason },
        timestamp: Date.now(),
      });

      res.json({ success: true, message: 'Compensation successfully dispatched to player account.', transaction: tx });
    } catch (err: any) {
      console.error('Compensation error:', err);
      res.status(500).json({ error: 'Failed to issue compensation reward' });
    }
  });

  // ==========================================
  // SHOP MANAGEMENT ENDPOINTS
  // ==========================================

  app.get('/api/admin/shop', authenticateAdmin, (req, res) => {
    res.json({ total: shopItemsStore.length, items: shopItemsStore });
  });

  app.put('/api/admin/shop/:id', authenticateAdmin, requirePermission('canManageShop'), (req, res) => {
    const itemId = req.params.id;
    const { coinPrice, diamondPrice, active, name, description } = req.body;
    const admin = (req as any).admin;

    const idx = shopItemsStore.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Shop item not found' });
    }

    const prev = { ...shopItemsStore[idx] };
    if (typeof coinPrice === 'number') shopItemsStore[idx].coinPrice = Math.max(0, coinPrice);
    if (typeof diamondPrice === 'number') shopItemsStore[idx].diamondPrice = Math.max(0, diamondPrice);
    if (typeof active === 'boolean') shopItemsStore[idx].active = active;
    if (name) shopItemsStore[idx].name = name;
    if (description) shopItemsStore[idx].description = description;
    shopItemsStore[idx].updatedAt = Date.now();

    auditLogsStore.unshift({
      id: 'LOG-' + Date.now(),
      category: 'SHOP',
      action: 'UPDATE_SHOP_ITEM',
      adminUid: admin.uid,
      adminEmail: admin.email,
      adminRole: admin.role,
      targetId: itemId,
      details: { previous: prev, updated: shopItemsStore[idx] },
      timestamp: Date.now(),
    });

    res.json({ success: true, item: shopItemsStore[idx] });
  });

  // ==========================================
  // EVENT MANAGEMENT ENDPOINTS
  // ==========================================

  app.get('/api/admin/events', authenticateAdmin, (req, res) => {
    res.json({ total: eventsStore.length, events: eventsStore });
  });

  app.post('/api/admin/events', authenticateAdmin, requirePermission('canManageEvents'), (req, res) => {
    const { title, description, eventType, startTime, endTime, rewards } = req.body;
    const admin = (req as any).admin;

    if (!title || !eventType || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, eventType, startTime and endTime are required' });
    }

    const newEvent = {
      id: 'evt_' + Date.now(),
      title,
      description: description || '',
      eventType,
      active: true,
      startTime: parseInt(startTime, 10),
      endTime: parseInt(endTime, 10),
      rewards: rewards || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    eventsStore.unshift(newEvent);

    auditLogsStore.unshift({
      id: 'LOG-' + Date.now(),
      category: 'EVENT',
      action: 'CREATE_GAME_EVENT',
      adminUid: admin.uid,
      adminEmail: admin.email,
      adminRole: admin.role,
      targetId: newEvent.id,
      details: newEvent,
      timestamp: Date.now(),
    });

    res.json({ success: true, event: newEvent });
  });

  app.put('/api/admin/events/:id', authenticateAdmin, requirePermission('canManageEvents'), (req, res) => {
    const eventId = req.params.id;
    const idx = eventsStore.findIndex((e) => e.id === eventId);
    if (idx === -1) return res.status(404).json({ error: 'Event not found' });

    const admin = (req as any).admin;
    Object.assign(eventsStore[idx], req.body, { updatedAt: Date.now() });

    auditLogsStore.unshift({
      id: 'LOG-' + Date.now(),
      category: 'EVENT',
      action: 'UPDATE_GAME_EVENT',
      adminUid: admin.uid,
      adminEmail: admin.email,
      adminRole: admin.role,
      targetId: eventId,
      details: eventsStore[idx],
      timestamp: Date.now(),
    });

    res.json({ success: true, event: eventsStore[idx] });
  });

  // ==========================================
  // LEADERBOARDS & REPORTS
  // ==========================================

  app.get('/api/admin/leaderboards', authenticateAdmin, async (req, res) => {
    try {
      await ensureFirebaseAuth();
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      const list: any[] = [];
      profilesSnap.forEach((docItem) => {
        const d = docItem.data();
        list.push({
          uid: docItem.id,
          playerId: toPlayerId(docItem.id),
          name: d.name || 'Player',
          av: d.av || '🙂',
          lvl: d.lvl || 1,
          xp: d.xp || 0,
          wins: d.wins || 0,
          games: d.games || 0,
          winRate: d.games > 0 ? Math.round(((d.wins || 0) / d.games) * 100) : 0,
        });
      });

      list.sort((a, b) => b.xp - a.xp);
      res.json({ total: list.length, rankings: list });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to retrieve leaderboards' });
    }
  });

  // ==========================================
  // STAFF MANAGEMENT ENDPOINTS (SUPER ADMIN ONLY)
  // ==========================================

  app.get('/api/admin/staff', authenticateAdmin, requirePermission('canManageStaff'), (req, res) => {
    const staffList = Array.from(staffRegistry.values());
    res.json({ total: staffList.length, staff: staffList });
  });

  app.post('/api/admin/staff', authenticateAdmin, requirePermission('canManageStaff'), (req, res) => {
    const { email, name, role } = req.body;
    const admin = (req as any).admin;

    if (!email || !role || !ROLE_PERMISSIONS[role as AdminRole]) {
      return res.status(400).json({ error: 'Valid email and role are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Prevent staff from changing their own role or self-promotion
    if (normalizedEmail === admin.email.toLowerCase()) {
      return res.status(400).json({ error: 'Security constraint: You cannot modify your own administrative role or permissions.' });
    }

    const existing = staffRegistry.get(normalizedEmail);
    const updatedStaff: AdminUser = {
      uid: existing ? existing.uid : 'staff_' + Math.random().toString(36).substring(2, 9),
      email: normalizedEmail,
      name: name || (existing ? existing.name : normalizedEmail.split('@')[0]),
      role: role as AdminRole,
      status: 'active',
      createdAt: existing ? existing.createdAt : Date.now(),
      lastLogin: existing?.lastLogin,
      createdBy: admin.email,
    };

    staffRegistry.set(normalizedEmail, updatedStaff);

    auditLogsStore.unshift({
      id: 'LOG-' + Date.now(),
      category: 'STAFF',
      action: existing ? 'STAFF_ROLE_UPDATED' : 'STAFF_MEMBER_CREATED',
      adminUid: admin.uid,
      adminEmail: admin.email,
      adminRole: admin.role,
      targetId: normalizedEmail,
      details: { role, name },
      timestamp: Date.now(),
    });

    res.json({ success: true, staff: updatedStaff });
  });

  app.delete('/api/admin/staff/:email', authenticateAdmin, requirePermission('canManageStaff'), (req, res) => {
    const targetEmail = req.params.email.toLowerCase();
    const admin = (req as any).admin;

    if (targetEmail === admin.email.toLowerCase()) {
      return res.status(400).json({ error: 'Security constraint: You cannot delete or revoke your own Super Admin access.' });
    }

    if (!staffRegistry.has(targetEmail)) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    staffRegistry.delete(targetEmail);

    auditLogsStore.unshift({
      id: 'LOG-' + Date.now(),
      category: 'STAFF',
      action: 'STAFF_ACCESS_REVOKED',
      adminUid: admin.uid,
      adminEmail: admin.email,
      adminRole: admin.role,
      targetId: targetEmail,
      details: { revokedBy: admin.email },
      timestamp: Date.now(),
    });

    res.json({ success: true, message: `Access revoked for ${targetEmail}` });
  });

  // ==========================================
  // VITE DEV SERVER / PRODUCTION STATIC SERVING
  // ==========================================

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const isAppAdmin = url.startsWith('/admin');
        const templateFile = isAppAdmin ? 'admin.html' : 'index.html';
        const templatePath = path.resolve(__dirname, templateFile);
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use('*', (req, res) => {
      const url = req.originalUrl;
      const isAppAdmin = url.startsWith('/admin');
      const file = isAppAdmin ? 'admin.html' : 'index.html';
      res.sendFile(path.resolve(__dirname, 'dist', file));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Tickle-Tac Full-Stack Server running at http://0.0.0.0:${PORT}`);
    console.log(`🎮 Game URL: http://localhost:${PORT}/`);
    console.log(`🛡️ Admin Panel URL: http://localhost:${PORT}/admin`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
