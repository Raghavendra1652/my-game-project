import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { PlayerAccount } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  Search,
  Filter,
  RefreshCw,
  Coins,
  Gem,
  Trophy,
  Copy,
  Check,
  Eye,
  ShieldAlert,
  Ban,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

interface PlayerManagementViewProps {
  initialSearchQuery?: string;
  onInspectPlayer: (player: PlayerAccount) => void;
  onAdjustCurrencyForPlayer: (playerId: string) => void;
  onIssueRewardForPlayer: (playerId: string) => void;
}

export const PlayerManagementView: React.FC<PlayerManagementViewProps> = ({
  initialSearchQuery = '',
  onInspectPlayer,
  onAdjustCurrencyForPlayer,
  onIssueRewardForPlayer,
}) => {
  const { permissions, adminUser } = useAdminAuth();
  const [players, setPlayers] = useState<PlayerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [copiedPid, setCopiedPid] = useState<string | null>(null);
  const [actionLoadingUid, setActionLoadingUid] = useState<string | null>(null);

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getPlayers(searchQuery, statusFilter);
      setPlayers(res.players);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPlayers();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPid(id);
    setTimeout(() => setCopiedPid(null), 2000);
  };

  const handleToggleStatus = async (player: PlayerAccount) => {
    const newStatus = player.status === 'suspended' ? 'active' : 'suspended';
    const actionLabel = newStatus === 'suspended' ? 'SUSPEND' : 'RESTORE';
    const reason = window.prompt(
      `Enter mandatory administrative reason to ${actionLabel} account for ${player.name} (${player.playerId}):`,
      newStatus === 'suspended' ? 'Suspicious match patterns or terms violation' : 'Account appeal accepted'
    );

    if (reason === null) return;
    if (reason.trim().length < 3) {
      alert('A valid reason (minimum 3 characters) is required to modify account status.');
      return;
    }

    setActionLoadingUid(player.rawUid || player.uid);
    try {
      await adminApi.updatePlayerStatus(player.rawUid || player.uid, newStatus, reason.trim());
      // Refresh list
      await fetchPlayers();
    } catch (e: any) {
      alert(`Status update failed: ${e.message}`);
    } finally {
      setActionLoadingUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight">Player Directory & Accounts</h2>
            <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
              Search by Public Player ID (TT-XXXXXX), Name, Email (if role permits), or UID
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#889bb6] bg-[#0b1424] px-3 py-1.5 rounded-lg border border-[#263857]">
              Total Found: <b className="text-[#eef4fc]">{players.length}</b>
            </span>
            <button
              type="button"
              onClick={fetchPlayers}
              disabled={loading}
              className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-lg transition-all cursor-pointer"
              title="Refresh player list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-8">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Public Player ID (e.g. TT-CP3H5X), Name (e.g. Raghav), or Email…"
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs font-mono text-[#eef4fc] rounded-xl pl-9 pr-3 py-2.5 outline-none transition-colors"
            />
            <Search className="w-4 h-4 text-[#889bb6] absolute left-3 top-2.5" />
          </div>

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs font-mono text-[#eef4fc] rounded-xl px-3 py-2.5 outline-none transition-colors cursor-pointer"
            >
              <option value="all">Status: All</option>
              <option value="active">Active Accounts</option>
              <option value="suspended">Suspended Accounts</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20 active:scale-[0.98]"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* Players Data Table */}
      <div className="bg-[#132038] border border-[#263857] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b1424]/90 border-b border-[#263857] text-[11px] font-mono text-[#889bb6] uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Player ID</th>
                <th className="py-3.5 px-4 font-bold">Player</th>
                {permissions?.canViewPlayerEmails && <th className="py-3.5 px-4 font-bold">Email</th>}
                {permissions?.canViewPlayerUid && <th className="py-3.5 px-4 font-bold">Firebase UID</th>}
                <th className="py-3.5 px-4 font-bold">Balances</th>
                <th className="py-3.5 px-4 font-bold">Level & XP</th>
                <th className="py-3.5 px-4 font-bold">Record</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Last Active</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263857]/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#889bb6] font-mono">
                    <RefreshCw className="w-6 h-6 text-[#4f8fff] animate-spin mx-auto mb-2" />
                    Fetching player records from database…
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#889bb6] font-mono">
                    No players found matching query '{searchQuery}'. Try searching another ID or Name.
                  </td>
                </tr>
              ) : (
                players.map((p) => {
                  const winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
                  const isSuspended = p.status === 'suspended';

                  return (
                    <tr
                      key={p.rawUid || p.uid}
                      className="hover:bg-[#192a4a]/60 transition-colors group"
                    >
                      {/* Player ID TT-XXXXXX */}
                      <td className="py-3 px-4 font-mono font-bold text-[#4f8fff] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{p.playerId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(p.playerId, p.playerId)}
                            className="text-[#889bb6] hover:text-[#eef4fc] p-1 rounded hover:bg-[#16243d]"
                            title="Copy Player ID"
                          >
                            {copiedPid === p.playerId ? (
                              <Check className="w-3.5 h-3.5 text-[#10b981]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Player Avatar & Name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl shrink-0 drop-shadow-sm">{p.av || '🙂'}</span>
                          <div>
                            <div className="font-bold text-[#eef4fc] group-hover:text-[#4f8fff] transition-colors">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-[#889bb6] font-mono">{p.title || 'Rookie'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Account Email (Conditional on permission) */}
                      {permissions?.canViewPlayerEmails && (
                        <td className="py-3 px-4 text-[#889bb6] font-mono text-[11px] whitespace-nowrap">
                          {p.email ? (
                            <span className="text-[#eef4fc]">{p.email}</span>
                          ) : (
                            <span className="text-[#889bb6]/50 italic">Guest (Unlinked)</span>
                          )}
                        </td>
                      )}

                      {/* Firebase UID (Conditional on permission) */}
                      {permissions?.canViewPlayerUid && (
                        <td className="py-3 px-4 font-mono text-[11px] text-[#889bb6] whitespace-nowrap">
                          <span title={p.rawUid}>{p.uid}</span>
                        </td>
                      )}

                      {/* Balances */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold">
                        <div className="flex items-center gap-3">
                          <span className="text-[#fbbf24] flex items-center gap-1" title={`${p.points} Coins`}>
                            🪙 {p.points.toLocaleString()}
                          </span>
                          <span className="text-[#38bdf8] flex items-center gap-1" title={`${p.diamonds} Diamonds`}>
                            💎 {p.diamonds.toLocaleString()}
                          </span>
                        </div>
                      </td>

                      {/* Level & XP */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        <span className="font-bold text-[#eef4fc]">Lv {p.level}</span>{' '}
                        <span className="text-[10px] text-[#889bb6]">({p.xp} XP)</span>
                      </td>

                      {/* Match Record */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        <div>
                          <span className="text-[#10b981] font-bold">{p.wins}W</span> /{' '}
                          <span className="text-[#889bb6]">{p.games}G</span>{' '}
                          <span className="text-[10px] text-[#889bb6]">({winRate}%)</span>
                        </div>
                      </td>

                      {/* Account Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            isSuspended
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-red-400' : 'bg-emerald-400'}`} />
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-[#889bb6]">
                        {new Date(p.lastActive).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(p.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectPlayer(p)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#263857] bg-[#0b1424] hover:bg-[#16243d] text-[#eef4fc] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="Inspect complete player profile, match history, and save state"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#4f8fff]" />
                            <span>Inspect</span>
                          </button>

                          {permissions?.canAdjustCurrency && (
                            <button
                              type="button"
                              onClick={() => onAdjustCurrencyForPlayer(p.playerId)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#fbbf24]/30 bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 text-[#fbbf24] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Add or Deduct Coins and Diamonds"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>Adjust</span>
                            </button>
                          )}

                          {permissions?.canIssueCompensation && (
                            <button
                              type="button"
                              onClick={() => onIssueRewardForPlayer(p.playerId)}
                              className="px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Send compensation rewards"
                            >
                              <span>Reward</span>
                            </button>
                          )}

                          {permissions?.canSuspendAccounts && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p)}
                              disabled={actionLoadingUid === (p.rawUid || p.uid)}
                              className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                                isSuspended
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                  : 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                              }`}
                              title={isSuspended ? 'Restore player account' : 'Suspend player account'}
                            >
                              {isSuspended ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
