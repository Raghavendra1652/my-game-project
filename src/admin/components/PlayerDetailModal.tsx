import React, { useState } from 'react';
import { PlayerAccount } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminApi } from '../services/api';
import {
  X,
  User,
  Coins,
  Gem,
  Trophy,
  History,
  Gift,
  Shield,
  Ban,
  CheckCircle2,
  Calendar,
  Gamepad2,
  Award,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

interface PlayerDetailModalProps {
  player: PlayerAccount | null;
  onClose: () => void;
  onOpenCurrencyAdjust: (playerId: string) => void;
  onOpenCompensation: (playerId: string) => void;
  onStatusUpdated?: () => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  onClose,
  onOpenCurrencyAdjust,
  onOpenCompensation,
  onStatusUpdated,
}) => {
  const { permissions } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'unlocks' | 'transactions'>('overview');
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  if (!player) return null;

  const isSuspended = player.status === 'suspended';

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleAccountStatus = async () => {
    const newStatus = isSuspended ? 'active' : 'suspended';
    const reason = window.prompt(
      `Enter reason to ${newStatus === 'suspended' ? 'SUSPEND' : 'RESTORE'} ${player.name} (${player.playerId}):`,
      isSuspended ? 'Appeal review approved' : 'Administrative restriction'
    );
    if (!reason || reason.trim().length < 3) return;

    setStatusLoading(true);
    try {
      await adminApi.updatePlayerStatus(player.rawUid || player.uid, newStatus, reason.trim());
      player.status = newStatus;
      if (onStatusUpdated) onStatusUpdated();
    } catch (e: any) {
      alert(`Error updating account status: ${e.message}`);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08101f]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#132038] border-2 border-[#263857] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-up">
        {/* Modal Top Header */}
        <div className="p-6 pb-4 bg-gradient-to-b from-[#192a4a] to-[#132038] border-b border-[#263857] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl p-2 bg-[#0b1424] rounded-2xl border border-[#263857] shrink-0">
              {player.av || '🙂'}
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-extrabold text-[#eef4fc]">{player.name}</h3>
                <span className="text-xs font-mono font-bold text-[#4f8fff] px-2.5 py-0.5 rounded-lg bg-[#4f8fff]/15 border border-[#4f8fff]/30 flex items-center gap-1">
                  <span>{player.playerId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(player.playerId)}
                    className="hover:text-white"
                    title="Copy Player ID"
                  >
                    {copied ? <Check className="w-3 h-3 text-[#10b981]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    isSuspended
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                </span>
              </div>
              <div className="text-xs text-[#889bb6] font-mono mt-0.5 flex items-center gap-3">
                <span>Level {player.level} ({player.xp} XP)</span>
                <span>•</span>
                <span>{player.title || 'Rookie'}</span>
                {permissions?.canViewPlayerEmails && player.email && (
                  <>
                    <span>•</span>
                    <span className="text-[#eef4fc]">{player.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {permissions?.canAdjustCurrency && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCurrencyAdjust(player.playerId);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[#fbbf24] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>Adjust Currency</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#0b1424] hover:bg-[#16243d] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#263857] bg-[#0b1424]/40 font-mono text-xs">
          {[
            { id: 'overview', label: 'Overview & Save State', icon: User },
            { id: 'matches', label: `Match History (${(player.history || []).length})`, icon: Gamepad2 },
            { id: 'unlocks', label: `Unlocked Items (${(player.owned || []).length})`, icon: Gift },
            { id: 'transactions', label: `Transactions (${(player.transactions || []).length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 px-3.5 border-b-2 font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#4f8fff] text-[#4f8fff]'
                    : 'border-transparent text-[#889bb6] hover:text-[#eef4fc]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Wallet Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#0b1424] border border-[#263857]">
                  <span className="text-xs font-mono text-[#889bb6] block">Coins Balance</span>
                  <div className="text-2xl font-extrabold font-mono text-[#fbbf24] mt-1">
                    🪙 {player.points.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#889bb6] font-mono">Standard wallet currency</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#0b1424] border border-[#263857]">
                  <span className="text-xs font-mono text-[#889bb6] block">Diamonds Balance</span>
                  <div className="text-2xl font-extrabold font-mono text-[#38bdf8] mt-1">
                    💎 {player.diamonds.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#889bb6] font-mono">Premium cosmetic & hint tokens</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#0b1424] border border-[#263857]">
                  <span className="text-xs font-mono text-[#889bb6] block">Rank & Progression</span>
                  <div className="text-2xl font-extrabold font-mono text-[#10b981] mt-1">
                    Level {player.level}
                  </div>
                  <span className="text-[10px] text-[#889bb6] font-mono">{player.xp} XP total earned</span>
                </div>
              </div>

              {/* Match Statistics Grid */}
              <div className="p-5 rounded-2xl bg-[#0b1424] border border-[#263857] space-y-3">
                <h4 className="text-xs font-mono uppercase text-[#889bb6] font-bold">
                  Match Record & Performance
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#132038] border border-[#263857]">
                    <span className="text-[#889bb6] block text-[10px]">Total Matches</span>
                    <span className="text-lg font-bold text-[#eef4fc]">{player.games}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#132038] border border-[#263857]">
                    <span className="text-[#889bb6] block text-[10px]">Total Victories</span>
                    <span className="text-lg font-bold text-[#10b981]">{player.wins}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#132038] border border-[#263857]">
                    <span className="text-[#889bb6] block text-[10px]">Win Rate</span>
                    <span className="text-lg font-bold text-[#4f8fff]">
                      {player.games > 0 ? Math.round((player.wins / player.games) * 100) : 0}%
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#132038] border border-[#263857]">
                    <span className="text-[#889bb6] block text-[10px]">Best Win Streak</span>
                    <span className="text-lg font-bold text-[#fbbf24]">{player.best || 0}</span>
                  </div>
                </div>
              </div>

              {/* Account Security & Action Controls */}
              <div className="p-5 rounded-2xl bg-[#0b1424] border border-[#263857] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-mono uppercase text-[#889bb6] font-bold">
                    Administrative Restrictions & Safeguards
                  </h4>
                  <p className="text-xs text-[#889bb6] mt-0.5">
                    Account suspension prevents login and matchmaking while preserving cloud save progression and inventory.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {permissions?.canIssueCompensation && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCompensation(player.playerId);
                      }}
                      className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs font-mono transition-all cursor-pointer"
                    >
                      Issue Compensation Reward
                    </button>
                  )}

                  {permissions?.canSuspendAccounts && (
                    <button
                      type="button"
                      onClick={handleToggleAccountStatus}
                      disabled={statusLoading}
                      className={`px-4 py-2 rounded-xl font-bold text-xs font-mono transition-all cursor-pointer border ${
                        isSuspended
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 hover:bg-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border-red-500 hover:bg-red-500/30'
                      }`}
                    >
                      {statusLoading
                        ? 'Updating…'
                        : isSuspended
                        ? 'Restore Active Account'
                        : 'Suspend Account'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATCH HISTORY */}
          {activeTab === 'matches' && (
            <div className="space-y-4">
              {(!player.history || player.history.length === 0) ? (
                <div className="text-center py-12 text-xs font-mono text-[#889bb6]">
                  No recorded matches found for this player.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {player.history.map((match: any, idx: number) => {
                    const isWin = match.result === 'Win';
                    const isDraw = match.result === 'Draw';
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-[#0b1424] border border-[#263857] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isWin
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isDraw
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-red-500/20 text-red-300 border border-red-500/40'
                            }`}
                          >
                            {match.result?.charAt(0) || 'M'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#eef4fc]">
                                {match.result || 'Match'} · {match.mode?.toUpperCase() || 'CLASSIC'}
                              </span>
                              <span className="text-[#889bb6]">({match.size}×{match.size} Board)</span>
                            </div>
                            <div className="text-[11px] text-[#889bb6] mt-0.5">
                              {match.moves || 0} moves played • {match.date || 'Recent match'}
                            </div>
                          </div>
                        </div>

                        {Array.isArray(match.log) && match.log.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedMatch(selectedMatch === match ? null : match)}
                            className="px-3 py-1.5 rounded-lg border border-[#263857] bg-[#132038] hover:bg-[#192a4a] text-xs text-[#4f8fff] font-bold transition-all cursor-pointer"
                          >
                            {selectedMatch === match ? 'Hide Sequence' : 'Inspect Moves'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Move Inspector Drawer */}
              {selectedMatch && (
                <div className="p-4 rounded-2xl bg-[#08101f] border border-[#4f8fff]/40 space-y-2 animate-fade-in font-mono text-xs">
                  <div className="font-bold text-[#4f8fff] flex items-center justify-between pb-2 border-b border-[#263857]">
                    <span>Move Log Replay ({selectedMatch.log?.length || 0} moves)</span>
                    <button
                      type="button"
                      onClick={() => setSelectedMatch(null)}
                      className="text-[#889bb6] hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2">
                    {(selectedMatch.log || []).map((m: any, mIdx: number) => {
                      const row = Math.floor(m.index / selectedMatch.size) + 1;
                      const col = (m.index % selectedMatch.size) + 1;
                      return (
                        <div key={mIdx} className="p-2 rounded bg-[#132038] border border-[#263857] flex items-center justify-between">
                          <span className="text-[#889bb6]">#{mIdx + 1}</span>
                          <span className={m.mark === 'X' ? 'text-[#4f8fff] font-bold' : 'text-[#ff5a43] font-bold'}>
                            {m.mark} &rarr; ({row}, {col})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UNLOCKED INVENTORY */}
          {activeTab === 'unlocks' && (
            <div className="space-y-4">
              <div className="text-xs font-mono text-[#889bb6]">
                Unlocked Shop Emojis, Custom Game Symbols & Seasonal Skins owned by this player:
              </div>

              {(!player.owned || player.owned.length === 0) ? (
                <div className="text-center py-12 text-xs font-mono text-[#889bb6]">
                  No purchased cosmetics in player inventory.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {player.owned.map((item: string, i: number) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-[#0b1424] border border-[#263857] flex items-center gap-3"
                    >
                      <span className="text-2xl">{item}</span>
                      <div>
                        <div className="text-xs font-bold text-[#eef4fc]">Cosmetic Unlock</div>
                        <div className="text-[10px] text-[#10b981] font-mono font-bold">✓ Permanent</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SPECIFIC TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-3 font-mono text-xs">
              {(!player.transactions || player.transactions.length === 0) ? (
                <div className="text-center py-12 text-xs text-[#889bb6]">
                  No currency adjustments recorded for this specific player account yet.
                </div>
              ) : (
                player.transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl bg-[#0b1424] border border-[#263857] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#4f8fff]">{tx.id}</span>
                        <span className={`font-bold ${tx.action === 'add' ? 'text-[#10b981]' : 'text-[#ff5a43]'}`}>
                          {tx.action === 'add' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.currencyType.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#889bb6] mt-0.5">{tx.reason}</div>
                    </div>
                    <div className="text-right text-[11px] text-[#889bb6]">
                      <div>{new Date(tx.timestamp).toLocaleDateString()}</div>
                      <div>Bal: {tx.newBalance.toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
