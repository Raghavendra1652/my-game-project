import {
  AdminUser,
  AdminPermissions,
  DashboardStats,
  PlayerAccount,
  CurrencyTransaction,
  AuditLogItem,
  ShopItem,
  GameEvent,
  AdminRole,
} from '../types/admin';

class AdminApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('tt_admin_token') || null;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('tt_admin_token', token);
    } else {
      localStorage.removeItem('tt_admin_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  // Authentication
  async login(payload: { idToken?: string; demoRole?: AdminRole; email?: string }): Promise<{
    token: string;
    user: AdminUser;
    permissions: AdminPermissions;
  }> {
    const data = await this.request<{
      token: string;
      user: AdminUser;
      permissions: AdminPermissions;
    }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser(): Promise<{ user: AdminUser; permissions: AdminPermissions }> {
    return this.request<{ user: AdminUser; permissions: AdminPermissions }>('/api/admin/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/admin/dashboard/stats');
  }

  // Players
  async getPlayers(query: string = '', status: string = 'all'): Promise<{ total: number; players: PlayerAccount[] }> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status !== 'all') params.set('status', status);
    return this.request<{ total: number; players: PlayerAccount[] }>(`/api/admin/players?${params.toString()}`);
  }

  async getPlayerDetails(uidOrPid: string): Promise<PlayerAccount> {
    return this.request<PlayerAccount>(`/api/admin/players/${encodeURIComponent(uidOrPid)}`);
  }

  async updatePlayerStatus(uid: string, status: 'active' | 'suspended', reason: string): Promise<{ success: boolean; status: string }> {
    return this.request<{ success: boolean; status: string }>(`/api/admin/players/${encodeURIComponent(uid)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  }

  // Currency Adjustments
  async adjustCurrency(payload: {
    playerId: string;
    currencyType: 'coins' | 'diamonds';
    action: 'add' | 'deduct';
    amount: number;
    reason: string;
    idempotencyKey?: string;
  }): Promise<{
    success: boolean;
    message: string;
    isDuplicate?: boolean;
    transaction: CurrencyTransaction;
  }> {
    return this.request('/api/admin/currency/adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Transactions
  async getTransactions(filters: { q?: string; currency?: string; action?: string } = {}): Promise<{
    total: number;
    transactions: CurrencyTransaction[];
  }> {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.currency && filters.currency !== 'all') params.set('currency', filters.currency);
    if (filters.action && filters.action !== 'all') params.set('action', filters.action);
    return this.request<{ total: number; transactions: CurrencyTransaction[] }>(`/api/admin/transactions?${params.toString()}`);
  }

  // Audit Logs
  async getAuditLogs(): Promise<{ total: number; logs: AuditLogItem[] }> {
    return this.request<{ total: number; logs: AuditLogItem[] }>('/api/admin/audit-logs');
  }

  // Rewards
  async getRewardsHistory(): Promise<{ total: number; rewards: any[] }> {
    return this.request<{ total: number; rewards: any[] }>('/api/admin/rewards/history');
  }

  async issueCompensation(payload: {
    playerId: string;
    coins?: number;
    diamonds?: number;
    giftItem?: string;
    reason: string;
  }): Promise<{ success: boolean; message: string; transaction: CurrencyTransaction }> {
    return this.request('/api/admin/rewards/compensate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Shop Management
  async getShopItems(): Promise<{ total: number; items: ShopItem[] }> {
    return this.request<{ total: number; items: ShopItem[] }>('/api/admin/shop');
  }

  async updateShopItem(id: string, updates: Partial<ShopItem>): Promise<{ success: boolean; item: ShopItem }> {
    return this.request<{ success: boolean; item: ShopItem }>(`/api/admin/shop/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Event Management
  async getEvents(): Promise<{ total: number; events: GameEvent[] }> {
    return this.request<{ total: number; events: GameEvent[] }>('/api/admin/events');
  }

  async createEvent(event: Omit<GameEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; event: GameEvent }> {
    return this.request<{ success: boolean; event: GameEvent }>('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(id: string, updates: Partial<GameEvent>): Promise<{ success: boolean; event: GameEvent }> {
    return this.request<{ success: boolean; event: GameEvent }>(`/api/admin/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Leaderboards
  async getLeaderboards(): Promise<{ total: number; rankings: any[] }> {
    return this.request<{ total: number; rankings: any[] }>('/api/admin/leaderboards');
  }

  // Staff Management
  async getStaff(): Promise<{ total: number; staff: AdminUser[] }> {
    return this.request<{ total: number; staff: AdminUser[] }>('/api/admin/staff');
  }

  async saveStaff(staff: { email: string; name?: string; role: AdminRole }): Promise<{ success: boolean; staff: AdminUser }> {
    return this.request<{ success: boolean; staff: AdminUser }>('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(staff),
    });
  }

  async removeStaff(email: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/admin/staff/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  }
}

export const adminApi = new AdminApiService();
