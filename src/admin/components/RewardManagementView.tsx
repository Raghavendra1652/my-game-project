import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Gift, Coins, Gem, Sparkles, RefreshCw, Send, CheckCircle2, History, AlertTriangle } from 'lucide-react';

interface RewardManagementViewProps {
  initialPlayerId?: string;
}

export const RewardManagementView: React.FC<RewardManagementViewProps> = ({ initialPlayerId = '' }) => {
  const { permissions, adminUser } = useAdminAuth();
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [coins, setCoins] = useState(50);
  const [diamonds, setDiamonds] = useState(5);
  const [giftItem, setGiftItem] = useState('');
  const [reason, setReason] = useState('Technical issue compensation & match disconnect apology');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reward history
  const [rewardHistory, setRewardHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await adminApi.getRewardsHistory();
      setRewardHistory(res.rewards);
    } catch (e) {
      console.warn('Failed to load rewards history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDispatchReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId.trim()) {
      setStatusMessage({ type: 'error', text: 'Target Player ID is required.' });
      return;
    }
    if (coins <= 0 && diamonds <= 0 && !giftItem) {
      setStatusMessage({ type: 'error', text: 'Specify at least one reward component.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await adminApi.issueCompensation({
        playerId: playerId.trim(),
        coins,
        diamonds,
        giftItem: giftItem.trim() || undefined,
        reason: reason.trim(),
      });
      setStatusMessage({
        type: 'success',
        text: `Compensation successfully issued to ${playerId}! TX ID: ${res.transaction.id}`,
      });
      fetchHistory();
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to dispatch compensation' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-400" />
            <span>Reward & Compensation Management</span>
          </h2>
          <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
            Review daily reward claims, mission rewards, and dispatch approved player compensations
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHistory}
          className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin text-[#4f8fff]' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Issue Compensation Tool */}
        <div className="lg:col-span-5 bg-[#132038] border border-[#263857] p-6 rounded-2xl shadow-lg space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#263857]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#eef4fc] font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#fbbf24]" />
              <span>Issue Compensation Package</span>
            </h3>
            <span className="text-[10px] font-mono text-[#889bb6]">Support & Admins</span>
          </div>

          <form onSubmit={handleDispatchReward} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-[#889bb6] font-bold uppercase mb-1">
                Recipient Player ID (TT-XXXXXX) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="e.g. TT-CP3H5X or TT-8K29XQ"
                className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs text-[#eef4fc] rounded-xl p-3 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Compensation Coins (🪙)</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={coins}
                  onChange={(e) => setCoins(parseInt(e.target.value || '0', 10))}
                  className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-sm font-bold text-[#fbbf24] rounded-xl p-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Compensation Diamonds (💎)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={diamonds}
                  onChange={(e) => setDiamonds(parseInt(e.target.value || '0', 10))}
                  className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-sm font-bold text-[#38bdf8] rounded-xl p-2.5 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#889bb6] font-bold uppercase mb-1">Gift Cosmetic Unlock (Optional)</label>
              <select
                value={giftItem}
                onChange={(e) => setGiftItem(e.target.value)}
                className="w-full bg-[#0b1424] border border-[#263857] text-xs text-[#eef4fc] rounded-xl p-2.5 outline-none cursor-pointer"
              >
                <option value="">-- No cosmetic gift --</option>
                <option value="⭐">⭐ Star Symbol</option>
                <option value="❤️">❤️ Heart Symbol</option>
                <option value="👑">👑 Crown Emoji</option>
                <option value="💎">💎 Diamond Emoji</option>
                <option value="🚁">🚁 Helicopter Symbol</option>
                <option value="🐉">🐉 Mystic Dragon</option>
                <option value="🌌">🌌 Exclusive Galaxy Skin</option>
              </select>
            </div>

            <div>
              <label className="block text-[#889bb6] font-bold uppercase mb-1">
                Mandatory Compensation Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Detail technical or gameplay incident…"
                className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs text-[#eef4fc] rounded-xl p-2.5 outline-none"
              />
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/40 text-red-300'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !permissions?.canIssueCompensation}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Dispatching…' : 'Dispatch Compensation Package'}</span>
            </button>
          </form>
        </div>

        {/* Reward History & Daily Claim Audit */}
        <div className="lg:col-span-7 bg-[#132038] border border-[#263857] p-6 rounded-2xl shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#263857]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#eef4fc] font-mono flex items-center gap-2">
              <History className="w-4 h-4 text-[#4f8fff]" />
              <span>Compensation & Reward Log History</span>
            </h3>
            <span className="text-xs font-mono text-[#889bb6]">{rewardHistory.length} Records</span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
            {loadingHistory ? (
              <div className="text-center py-12 text-xs font-mono text-[#889bb6]">Loading reward logs…</div>
            ) : rewardHistory.length === 0 ? (
              <div className="text-center py-12 text-xs font-mono text-[#889bb6]">
                No compensation rewards dispatched yet.
              </div>
            ) : (
              rewardHistory.map((r, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-[#0b1424] border border-[#263857] flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#eef4fc]">{r.playerId}</span>
                      <span className="text-[#889bb6]">({r.playerName})</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        +{r.amount} {r.currencyType.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#889bb6] mt-0.5">{r.reason}</div>
                  </div>

                  <div className="text-right text-[10px] text-[#889bb6] shrink-0">
                    <div>{new Date(r.timestamp).toLocaleDateString()}</div>
                    <div className="text-[#eef4fc]">{r.adminEmail?.split('@')[0]}</div>
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
