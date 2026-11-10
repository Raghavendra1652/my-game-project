import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { PlayerAccount, CurrencyTransaction } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  Coins,
  Gem,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  RefreshCw,
  Plus,
  Minus,
  Copy,
  Check,
  FileCheck,
  ExternalLink,
} from 'lucide-react';

interface CurrencyAdjustmentViewProps {
  initialPlayerId?: string;
  onViewTransactionHistory?: () => void;
}

export const CurrencyAdjustmentView: React.FC<CurrencyAdjustmentViewProps> = ({
  initialPlayerId = '',
  onViewTransactionHistory,
}) => {
  const { adminUser, permissions } = useAdminAuth();

  // Workflow state
  const [searchPid, setSearchPid] = useState(initialPlayerId);
  const [isSearching, setIsSearching] = useState(false);
  const [playerAccount, setPlayerAccount] = useState<PlayerAccount | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Form parameters
  const [currencyType, setCurrencyType] = useState<'coins' | 'diamonds'>('coins');
  const [action, setAction] = useState<'add' | 'deduct'>('add');
  const [amount, setAmount] = useState<number>(100);
  const [reason, setReason] = useState<string>('');
  const [reasonPreset, setReasonPreset] = useState<string>('');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionResult, setTransactionResult] = useState<CurrencyTransaction | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Auto-search if initialPlayerId is provided
  useEffect(() => {
    if (initialPlayerId) {
      setSearchPid(initialPlayerId);
      performSearch(initialPlayerId);
    }
  }, [initialPlayerId]);

  const performSearch = async (pidToSearch: string) => {
    if (!pidToSearch.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setTransactionResult(null);
    try {
      // Find player by Player ID or UID
      const res = await adminApi.getPlayers(pidToSearch.trim());
      if (res.players.length === 0) {
        setSearchError(`No player account found with ID or Name '${pidToSearch}'. Please check the Player ID.`);
        setPlayerAccount(null);
      } else {
        // Fetch detailed profile
        const target = res.players[0];
        const detailed = await adminApi.getPlayerDetails(target.rawUid || target.uid);
        setPlayerAccount(detailed);
      }
    } catch (e: any) {
      setSearchError(e.message || 'Search failed');
      setPlayerAccount(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchPid);
  };

  // Calculations
  const currentBalance = playerAccount
    ? currencyType === 'coins'
      ? playerAccount.points
      : playerAccount.diamonds
    : 0;

  const balanceDelta = action === 'add' ? amount : -amount;
  const proposedNewBalance = currentBalance + balanceDelta;
  const isNegativeForbidden = proposedNewBalance < 0;

  // Presets
  const REASON_PRESETS = [
    'Compensation for reported technical issue or match disconnect',
    'Official tournament / community event prize award',
    'Customer service appeal approved',
    'Manual reconciliation for transaction error',
    'Disciplinary deduction for terms of service / fair play violation',
  ];

  const handlePresetSelect = (p: string) => {
    setReasonPreset(p);
    setReason(p);
  };

  const handleInitiateAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!playerAccount) {
      setSubmissionError('Please search and verify a player account first.');
      return;
    }
    if (amount <= 0) {
      setSubmissionError('Amount must be a positive number greater than 0.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setSubmissionError('A mandatory reason (minimum 3 characters) is required.');
      return;
    }
    if (isNegativeForbidden) {
      setSubmissionError(`Cannot deduct ${amount} ${currencyType}: Operation would result in a negative balance (${proposedNewBalance}).`);
      return;
    }

    setShowConfirmModal(true);
  };

  const handleExecuteTransaction = async () => {
    if (!playerAccount) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const idempotencyKey = `idem_${playerAccount.playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const result = await adminApi.adjustCurrency({
        playerId: playerAccount.playerId,
        currencyType,
        action,
        amount,
        reason: reason.trim(),
        idempotencyKey,
      });

      setTransactionResult(result.transaction);
      setShowConfirmModal(false);

      // Refresh local player account state to reflect the new balance
      const updated = await adminApi.getPlayerDetails(playerAccount.rawUid || playerAccount.uid);
      setPlayerAccount(updated);
    } catch (err: any) {
      setSubmissionError(err.message || 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyReceipt = () => {
    if (!transactionResult) return;
    const text = `TICKLE-TAC TRANSACTION RECEIPT\nID: ${transactionResult.id}\nPlayer: ${transactionResult.playerName} (${transactionResult.playerId})\nAction: ${transactionResult.action.toUpperCase()} ${transactionResult.amount.toLocaleString()} ${transactionResult.currencyType.toUpperCase()}\nPrevious Balance: ${transactionResult.previousBalance.toLocaleString()}\nNew Balance: ${transactionResult.newBalance.toLocaleString()}\nReason: ${transactionResult.reason}\nAdmin: ${transactionResult.adminEmail} (${transactionResult.adminRole})\nTimestamp: ${new Date(transactionResult.timestamp).toISOString()}`;
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const handleResetForNewAdjustment = () => {
    setTransactionResult(null);
    setAmount(100);
    setReason('');
    setReasonPreset('');
    setSubmissionError(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Workflow Step Tracker */}
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#fbbf24]" />
              <span>Currency Management & Ledger Adjustment</span>
            </h2>
            <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
              Secure, server-validated 11-step transaction workflow with atomic execution and immutable audit trail
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#10b981] bg-[#10b981]/10 px-3 py-1.5 rounded-lg border border-[#10b981]/30">
            <Shield className="w-3.5 h-3.5" />
            <span>Idempotency Protected</span>
          </div>
        </div>

        {/* Workflow Diagram */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-[#263857]/60 text-[11px] font-mono">
          <div className={`p-2.5 rounded-xl border ${playerAccount ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]' : 'bg-[#0b1424] border-[#263857] text-[#889bb6]'}`}>
            <div className="font-bold">1. Verify Player</div>
            <div className="text-[10px] opacity-80">{playerAccount ? `✓ ${playerAccount.playerId}` : 'Search TT-XXXXXX'}</div>
          </div>
          <div className={`p-2.5 rounded-xl border ${playerAccount ? 'bg-blue-500/10 border-blue-500/40 text-blue-300' : 'bg-[#0b1424] border-[#263857] text-[#889bb6]'}`}>
            <div className="font-bold">2. Configure Delta</div>
            <div className="text-[10px] opacity-80">{action.toUpperCase()} {amount} {currencyType}</div>
          </div>
          <div className={`p-2.5 rounded-xl border ${reason.trim().length >= 3 ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-[#0b1424] border-[#263857] text-[#889bb6]'}`}>
            <div className="font-bold">3. Mandatory Reason</div>
            <div className="text-[10px] opacity-80">{reason ? 'Reason documented' : 'Required for audit'}</div>
          </div>
          <div className={`p-2.5 rounded-xl border ${transactionResult ? 'bg-[#10b981]/20 border-[#10b981]/60 text-[#10b981]' : 'bg-[#0b1424] border-[#263857] text-[#889bb6]'}`}>
            <div className="font-bold">4. Atomic Execution</div>
            <div className="text-[10px] opacity-80">{transactionResult ? 'TX Completed' : 'Server Execution'}</div>
          </div>
        </div>
      </div>

      {/* Step 1: Search & Verify Account */}
      <div className="bg-[#132038] border border-[#263857] p-6 rounded-2xl shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#eef4fc] font-mono flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#4f8fff] text-white flex items-center justify-center text-xs font-bold">1</span>
            <span>Search & Retrieve Player Account</span>
          </h3>
          <span className="text-xs text-[#889bb6] font-mono">Target by Permanent Player ID</span>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchPid}
              onChange={(e) => setSearchPid(e.target.value)}
              placeholder="Enter Player ID (e.g. TT-CP3H5X or TT-8K29XQ) or Player Name…"
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-sm font-mono text-[#eef4fc] rounded-xl pl-10 pr-4 py-3 outline-none transition-colors"
            />
            <Search className="w-5 h-5 text-[#889bb6] absolute left-3.5 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={isSearching || !searchPid.trim()}
            className="px-6 py-3 bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50 shrink-0"
          >
            {isSearching ? 'Verifying…' : 'Retrieve Account'}
          </button>
        </form>

        {searchError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
            ⚠️ {searchError}
          </div>
        )}

        {/* Player Verification Card */}
        {playerAccount && (
          <div className="p-4 rounded-xl bg-[#0b1424] border-2 border-[#10b981]/50 space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-[#263857]">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-1 bg-[#16243d] rounded-xl border border-[#263857]">
                  {playerAccount.av || '🙂'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-[#eef4fc]">{playerAccount.name}</span>
                    <span className="text-xs font-mono font-bold text-[#4f8fff] px-2 py-0.5 rounded bg-[#4f8fff]/15 border border-[#4f8fff]/30">
                      {playerAccount.playerId}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                      ✓ Verified Active
                    </span>
                  </div>
                  <div className="text-xs text-[#889bb6] font-mono mt-0.5">
                    Level {playerAccount.level} · {playerAccount.title || 'Rookie'} · Match Record: {playerAccount.wins}W / {playerAccount.games}G
                  </div>
                </div>
              </div>

              {permissions?.canViewPlayerEmails && playerAccount.email && (
                <div className="text-right text-xs font-mono text-[#889bb6]">
                  <div>Account Email:</div>
                  <div className="text-[#eef4fc] font-semibold">{playerAccount.email}</div>
                </div>
              )}
            </div>

            {/* Current Balances Display */}
            <div>
              <div className="text-[11px] font-mono uppercase text-[#889bb6] font-bold mb-2">
                Step 3: Current Live Balances in Player Wallet
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setCurrencyType('coins')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    currencyType === 'coins'
                      ? 'bg-amber-500/15 border-[#fbbf24] shadow-sm shadow-amber-500/10'
                      : 'bg-[#132038] border-[#263857] hover:border-[#fbbf24]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#889bb6] font-bold">Coins Balance (🪙)</span>
                    {currencyType === 'coins' && <span className="text-[10px] font-bold text-[#fbbf24]">SELECTED</span>}
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-[#fbbf24] mt-1">
                    {playerAccount.points.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#889bb6] font-mono mt-1">Standard match & daily rewards</div>
                </div>

                <div
                  onClick={() => setCurrencyType('diamonds')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    currencyType === 'diamonds'
                      ? 'bg-cyan-500/15 border-[#38bdf8] shadow-sm shadow-cyan-500/10'
                      : 'bg-[#132038] border-[#263857] hover:border-[#38bdf8]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#889bb6] font-bold">Diamonds Balance (💎)</span>
                    {currencyType === 'diamonds' && <span className="text-[10px] font-bold text-[#38bdf8]">SELECTED</span>}
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-[#38bdf8] mt-1">
                    {playerAccount.diamonds.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#889bb6] font-mono mt-1">Premium cosmetics & move hints</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Configure Currency Adjustment */}
      {playerAccount && !transactionResult && (
        <form onSubmit={handleInitiateAdjustment} className="bg-[#132038] border border-[#263857] p-6 rounded-2xl shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-[#263857] pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#eef4fc] font-mono flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#4f8fff] text-white flex items-center justify-center text-xs font-bold">2</span>
              <span>Configure Currency Action & Mandatory Reason</span>
            </h3>
            <span className="text-xs text-[#889bb6] font-mono">Backend Enforced</span>
          </div>

          {/* Action selection (Add / Deduct) */}
          <div>
            <label className="block text-xs font-mono uppercase text-[#889bb6] font-bold mb-2">
              Select Operation
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction('add')}
                className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  action === 'add'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-[#0b1424] text-[#889bb6] border-[#263857] hover:bg-[#16243d]'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Add {currencyType === 'coins' ? 'Coins 🪙' : 'Diamonds 💎'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('deduct')}
                className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  action === 'deduct'
                    ? 'bg-red-500/20 text-red-300 border-red-500 shadow-md shadow-red-500/10'
                    : 'bg-[#0b1424] text-[#889bb6] border-[#263857] hover:bg-[#16243d]'
                }`}
              >
                <Minus className="w-4 h-4" />
                <span>Deduct {currencyType === 'coins' ? 'Coins 🪙' : 'Diamonds 💎'}</span>
              </button>
            </div>
          </div>

          {/* Amount input & quick buttons */}
          <div>
            <label className="block text-xs font-mono uppercase text-[#889bb6] font-bold mb-2">
              Adjustment Amount
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || '0', 10)))}
                className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xl font-mono font-bold text-[#eef4fc] rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>

            {/* Quick amount shortcuts */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {[50, 100, 250, 500, 1000, 5000].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmount(quick)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    amount === quick
                      ? 'bg-[#4f8fff] text-white border-[#4f8fff]'
                      : 'bg-[#0b1424] text-[#889bb6] border-[#263857] hover:bg-[#16243d] hover:text-[#eef4fc]'
                  }`}
                >
                  +{quick.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Mandatory Reason */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-mono uppercase text-[#889bb6] font-bold">
                Mandatory Administrative Reason <span className="text-[#ff5a43]">*</span>
              </label>
              <span className="text-[11px] text-[#889bb6] font-mono">Recorded in immutable audit log</span>
            </div>

            {/* Presets */}
            <div className="mb-2.5">
              <select
                value={reasonPreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full bg-[#0b1424] border border-[#263857] text-xs font-mono text-[#889bb6] rounded-xl px-3 py-2 outline-none cursor-pointer"
              >
                <option value="">-- Choose from standard operational presets --</option>
                {REASON_PRESETS.map((p, i) => (
                  <option key={i} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide clear administrative justification (e.g. Compensation for network disconnect during Semi-Final)…"
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs font-mono text-[#eef4fc] rounded-xl p-3 outline-none transition-colors"
            />
          </div>

          {/* Step 8: Live Balance Preview Diff */}
          <div className="p-4 rounded-xl bg-[#0b1424] border border-[#263857]">
            <div className="text-xs font-mono uppercase tracking-wider text-[#889bb6] font-bold mb-3 flex items-center justify-between">
              <span>Proposed Balance Calculation</span>
              <span className="text-[10px] text-[#889bb6]">Preview before commit</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-center sm:text-left">
              <div>
                <div className="text-[11px] text-[#889bb6]">Current Balance</div>
                <div className="text-xl font-bold text-[#eef4fc]">
                  {currentBalance.toLocaleString()} {currencyType === 'coins' ? '🪙' : '💎'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${action === 'add' ? 'text-[#10b981]' : 'text-[#ff5a43]'}`}>
                  {action === 'add' ? '+' : '-'}{amount.toLocaleString()}
                </span>
                <ArrowRight className="w-5 h-5 text-[#889bb6]" />
              </div>

              <div>
                <div className="text-[11px] text-[#889bb6]">New Balance</div>
                <div
                  className={`text-2xl font-extrabold ${
                    isNegativeForbidden ? 'text-[#ff5a43]' : 'text-[#10b981]'
                  }`}
                >
                  {proposedNewBalance.toLocaleString()} {currencyType === 'coins' ? '🪙' : '💎'}
                </div>
              </div>
            </div>

            {isNegativeForbidden && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Negative balance prevention triggered. Current balance ({currentBalance}) is insufficient for a deduction of {amount}.
                </span>
              </div>
            )}
          </div>

          {submissionError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
              ⚠️ {submissionError}
            </div>
          )}

          {/* Submit Trigger */}
          <button
            type="submit"
            disabled={isNegativeForbidden || !reason.trim() || amount <= 0}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#4f8fff] to-[#2563eb] hover:from-[#3b82f6] hover:to-[#1d4ed8] text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>Verify & Request Administrator Confirmation &rarr;</span>
          </button>
        </form>
      )}

      {/* Step 11: Transaction Result Receipt */}
      {transactionResult && (
        <div className="bg-[#132038] border-2 border-[#10b981] p-6 rounded-2xl shadow-2xl space-y-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-[#263857]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-[#10b981] border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#eef4fc]">Transaction Successfully Executed</h3>
                <p className="text-xs text-[#10b981] font-mono">Committed atomically to live database</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyReceipt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#263857] bg-[#0b1424] hover:bg-[#16243d] text-xs font-mono text-[#eef4fc] transition-all cursor-pointer"
            >
              {copiedReceipt ? <Check className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedReceipt ? 'Receipt Copied!' : 'Copy Receipt'}</span>
            </button>
          </div>

          {/* Receipt Data Grid */}
          <div className="bg-[#0b1424] border border-[#263857] rounded-xl p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#263857]/60">
              <span className="text-[#889bb6]">Transaction ID:</span>
              <span className="font-bold text-[#4f8fff] text-sm">{transactionResult.id}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[#889bb6] block text-[11px]">Player ID / Name:</span>
                <span className="font-bold text-[#eef4fc]">{transactionResult.playerId} ({transactionResult.playerName})</span>
              </div>
              <div>
                <span className="text-[#889bb6] block text-[11px]">Executed By:</span>
                <span className="font-bold text-[#eef4fc]">{transactionResult.adminEmail}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#263857]/60">
              <div>
                <span className="text-[#889bb6] block text-[11px]">Previous Balance:</span>
                <span className="font-bold text-[#889bb6]">{transactionResult.previousBalance.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#889bb6] block text-[11px]">Delta Applied:</span>
                <span className={`font-bold ${transactionResult.action === 'add' ? 'text-[#10b981]' : 'text-[#ff5a43]'}`}>
                  {transactionResult.action === 'add' ? '+' : '-'}{transactionResult.amount.toLocaleString()} {transactionResult.currencyType.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[#889bb6] block text-[11px]">New Committed Balance:</span>
                <span className="font-bold text-[#10b981] text-sm">{transactionResult.newBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#263857]/60">
              <span className="text-[#889bb6] block text-[11px]">Mandatory Reason:</span>
              <span className="text-[#eef4fc]">{transactionResult.reason}</span>
            </div>

            <div className="flex items-center justify-between pt-2 text-[10px] text-[#889bb6]">
              <span>Timestamp: {new Date(transactionResult.timestamp).toLocaleString()}</span>
              <span>Status: COMPLETED (IMMUTABLE)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForNewAdjustment}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold text-xs transition-all cursor-pointer"
            >
              Adjust Another Player or Balance
            </button>

            {onViewTransactionHistory && (
              <button
                type="button"
                onClick={onViewTransactionHistory}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#263857] hover:bg-[#16243d] text-xs font-mono text-[#889bb6] hover:text-[#eef4fc] transition-all cursor-pointer"
              >
                Open Full Transaction History Ledger &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 9: Administrator Confirmation Modal */}
      {showConfirmModal && playerAccount && (
        <div className="fixed inset-0 z-50 bg-[#08101f]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#132038] border-2 border-[#fbbf24] rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3 pb-3 border-b border-[#263857]">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-[#fbbf24] border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#eef4fc]">Confirm Currency Adjustment</h3>
                <p className="text-xs text-[#889bb6] font-mono">Step 9: Explicit Administrator Authorization Required</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono bg-[#0b1424] p-4 rounded-xl border border-[#263857]">
              <div className="flex justify-between">
                <span className="text-[#889bb6]">Player ID:</span>
                <span className="font-bold text-[#4f8fff]">{playerAccount.playerId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#889bb6]">Player Name:</span>
                <span className="font-bold text-[#eef4fc]">{playerAccount.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#889bb6]">Currency Type:</span>
                <span className="font-bold text-white uppercase">{currencyType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#889bb6]">Action:</span>
                <span className={`font-bold ${action === 'add' ? 'text-[#10b981]' : 'text-[#ff5a43]'}`}>
                  {action.toUpperCase()} {amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#263857]">
                <span className="text-[#889bb6]">Balance Transition:</span>
                <span className="font-bold text-[#10b981]">
                  {currentBalance.toLocaleString()} &rarr; {proposedNewBalance.toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-[#263857]">
                <span className="text-[#889bb6] block mb-1">Reason:</span>
                <span className="text-[#eef4fc] italic">"{reason}"</span>
              </div>
              <div className="pt-2 border-t border-[#263857] text-[11px] text-[#889bb6]">
                Authorizing Administrator: <b className="text-[#eef4fc]">{adminUser?.email}</b> ({adminUser?.role})
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-[#263857] hover:bg-[#16243d] text-xs font-mono text-[#889bb6] hover:text-[#eef4fc] transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteTransaction}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-bold text-xs font-mono transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Committing Transaction…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Commit to Ledger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
