import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/api';
import { DashboardStats } from '../types/admin';
import {
  Users,
  UserCheck,
  Gamepad2,
  Coins,
  Gem,
  TrendingUp,
  Clock,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToPlayers: (query?: string) => void;
  onNavigateToCurrency: (playerId?: string) => void;
  onNavigateToTransactions: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToPlayers,
  onNavigateToCurrency,
  onNavigateToTransactions,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getDashboardStats();
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      onNavigateToPlayers(quickSearch.trim());
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#4f8fff] animate-spin mx-auto" />
          <div className="text-sm font-mono text-[#889bb6]">Loading live database metrics from project-r-64a0b…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight">Executive Dashboard</h2>
          <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
            Real-time live telemetry aggregated directly from Tickle-Tac Firestore database
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleQuickSearchSubmit} className="relative flex-1 md:w-72">
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search Player ID (TT-XXXXXX) or Name…"
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs font-mono text-[#eef4fc] rounded-xl pl-9 pr-3 py-2.5 outline-none transition-colors"
            />
            <Search className="w-4 h-4 text-[#889bb6] absolute left-3 top-2.5" />
          </form>

          <button
            type="button"
            onClick={loadStats}
            disabled={loading}
            className="p-2.5 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
            title="Refresh database metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Registered Players */}
        <div className="bg-[#132038] border border-[#263857] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#889bb6] font-bold">Registered</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-[#eef4fc] font-mono">
              {(stats?.totalPlayers || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-[#10b981] flex items-center gap-1 mt-1 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+{stats?.newRegistrations7d || 0} this week</span>
            </div>
          </div>
        </div>

        {/* Active Players (24h) */}
        <div className="bg-[#132038] border border-[#263857] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#889bb6] font-bold">Active (24h)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-[#10b981] font-mono">
              {(stats?.activePlayers24h || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-[#889bb6] mt-1 font-mono">
              {stats?.activePlayers7d || 0} active past 7 days
            </div>
          </div>
        </div>

        {/* Total Matches Recorded */}
        <div className="bg-[#132038] border border-[#263857] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#889bb6] font-bold">Matches</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Gamepad2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-[#eef4fc] font-mono">
              {(stats?.totalMatches || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-[#889bb6] mt-1 font-mono">
              Classic, Blitz & Tournament
            </div>
          </div>
        </div>

        {/* Coins in Circulation */}
        <div className="bg-[#132038] border border-[#263857] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#889bb6] font-bold">Coins Economy</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-[#fbbf24] border border-amber-500/20 flex items-center justify-center font-bold">
              🪙
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-[#fbbf24] font-mono">
              {(stats?.totalCoinsCirculation || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-[#889bb6] mt-1 font-mono">
              In circulation across wallets
            </div>
          </div>
        </div>

        {/* Diamonds in Circulation */}
        <div className="bg-[#132038] border border-[#263857] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#889bb6] font-bold">Diamonds</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-[#38bdf8] border border-cyan-500/20 flex items-center justify-center font-bold">
              💎
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-[#38bdf8] font-mono">
              {(stats?.totalDiamondsCirculation || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-[#889bb6] mt-1 font-mono">
              Premium hint & cosmetic tokens
            </div>
          </div>
        </div>

        {/* New Registrations */}
        <div className="bg-[#132038] border border-[#263857] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#889bb6] font-bold">New Today</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-[#eef4fc] font-mono">
              +{stats?.newRegistrationsToday || 0}
            </div>
            <div className="text-[11px] text-[#889bb6] mt-1 font-mono">
              New accounts in 24h
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Player Growth Visuals & Economy Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Bar Chart */}
        <div className="lg:col-span-2 bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#eef4fc]">Player Activity & Growth Trend</h3>
              <p className="text-xs text-[#889bb6] font-mono">Daily total accounts and active sessions</p>
            </div>
            <span className="text-xs font-mono text-[#4f8fff] bg-[#4f8fff]/10 px-2.5 py-1 rounded-lg border border-[#4f8fff]/20">
              7-Day Trend
            </span>
          </div>

          <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-[#263857]">
            {(stats?.playerGrowth || []).map((day, idx) => {
              const maxVal = Math.max(12, ...(stats?.playerGrowth || []).map((d) => d.players));
              const heightPct = Math.round((day.players / maxVal) * 100);
              const activePct = Math.round((day.active / maxVal) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-full relative">
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-[#0b1424] border border-[#263857] text-[10px] font-mono text-[#eef4fc] px-2 py-1 rounded shadow-xl pointer-events-none whitespace-nowrap z-20">
                      {day.date}: {day.players} players ({day.active} active)
                    </div>

                    {/* Total bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-1/2 bg-gradient-to-t from-[#4f8fff]/40 to-[#4f8fff] rounded-t-md transition-all group-hover:brightness-125"
                    />
                    {/* Active bar */}
                    <div
                      style={{ height: `${activePct}%` }}
                      className="w-1/2 bg-gradient-to-t from-[#10b981]/40 to-[#10b981] rounded-t-md transition-all group-hover:brightness-125"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[#889bb6]">{day.date}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 mt-3 text-xs font-mono text-[#889bb6]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#4f8fff]"></span>
              <span>Total Registered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#10b981]"></span>
              <span>Active Players</span>
            </div>
          </div>
        </div>

        {/* Currency Circulation Breakdown */}
        <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#eef4fc]">In-Game Economy Health</h3>
            <p className="text-xs text-[#889bb6] font-mono">Circulation distribution & liquidity</p>

            <div className="mt-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-[#0b1424] border border-[#263857]">
                <div className="flex items-center justify-between text-xs font-mono text-[#889bb6] mb-1">
                  <span>Coins in Player Wallets</span>
                  <span className="font-bold text-[#fbbf24]">🪙 {(stats?.totalCoinsCirculation || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-[#16243d] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#fbbf24] h-full w-[85%] rounded-full"></div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#889bb6] mt-1.5 font-mono">
                  <span>Match reward earn rate: 5 pts/win</span>
                  <span>Healthy velocity</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0b1424] border border-[#263857]">
                <div className="flex items-center justify-between text-xs font-mono text-[#889bb6] mb-1">
                  <span>Diamonds in Circulation</span>
                  <span className="font-bold text-[#38bdf8]">💎 {(stats?.totalDiamondsCirculation || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-[#16243d] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#38bdf8] h-full w-[45%] rounded-full"></div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#889bb6] mt-1.5 font-mono">
                  <span>Spendable on Move Hints & Mythics</span>
                  <span>Scarcity preserved</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#263857] mt-4">
            <button
              type="button"
              onClick={() => onNavigateToCurrency()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#4f8fff]/15 hover:bg-[#4f8fff]/25 text-[#4f8fff] border border-[#4f8fff]/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Launch Currency Adjustment Tool</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Transactions & Administrative Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Currency Ledger Transactions */}
        <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#eef4fc]">Recent Currency Transactions</h3>
              <p className="text-xs text-[#889bb6] font-mono">Live immutable ledger adjustments</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToTransactions}
              className="text-xs text-[#4f8fff] hover:underline font-mono font-semibold"
            >
              View All Ledger &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {(!stats?.recentTransactions || stats.recentTransactions.length === 0) ? (
              <div className="text-center py-8 text-xs font-mono text-[#889bb6]">
                No administrative transactions recorded yet.
              </div>
            ) : (
              stats.recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-[#0b1424] border border-[#263857] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        tx.action === 'add'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {tx.action === 'add' ? '+' : '-'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#eef4fc]">{tx.playerId}</span>
                        <span className="text-[#889bb6]">({tx.playerName})</span>
                      </div>
                      <div className="text-[11px] text-[#889bb6] line-clamp-1">{tx.reason}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono font-bold ${
                        tx.action === 'add' ? 'text-[#10b981]' : 'text-[#ff5a43]'
                      }`}
                    >
                      {tx.action === 'add' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.currencyType === 'coins' ? '🪙' : '💎'}
                    </div>
                    <div className="text-[10px] font-mono text-[#889bb6]">
                      Bal: {tx.newBalance.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Admin Audit Logs */}
        <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#eef4fc]">Administrative Activity Trail</h3>
              <p className="text-xs text-[#889bb6] font-mono">Immutable security and operations log</p>
            </div>
            <span className="text-xs font-mono text-[#10b981] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
              Audit Active
            </span>
          </div>

          <div className="space-y-2.5">
            {(!stats?.recentAuditLogs || stats.recentAuditLogs.length === 0) ? (
              <div className="text-center py-8 text-xs font-mono text-[#889bb6]">
                No recent administrative events recorded.
              </div>
            ) : (
              stats.recentAuditLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#0b1424] border border-[#263857] flex items-start justify-between text-xs font-mono"
                >
                  <div className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-[#4f8fff] shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#eef4fc]">{log.action}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#16243d] border border-[#263857] text-[#889bb6]">
                          {log.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#889bb6] mt-0.5">
                        Admin: <span className="text-[#eef4fc]">{log.adminEmail}</span> ({log.adminRole})
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#889bb6] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
