import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { CurrencyTransaction } from '../types/admin';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Coins,
  Gem,
  ExternalLink,
} from 'lucide-react';

export const TransactionHistoryView: React.FC = () => {
  const [transactions, setTransactions] = useState<CurrencyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getTransactions({
        q: searchQuery,
        currency: currencyFilter,
        action: actionFilter,
      });
      setTransactions(res.transactions);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currencyFilter, actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (!transactions.length) return;
    const headers = ['Transaction ID', 'Player ID', 'Player Name', 'Currency', 'Action', 'Amount', 'Previous Balance', 'New Balance', 'Reason', 'Admin Email', 'Admin Role', 'Timestamp'];
    const rows = transactions.map((t) => [
      t.id,
      t.playerId,
      `"${t.playerName}"`,
      t.currencyType,
      t.action,
      t.amount,
      t.previousBalance,
      t.newBalance,
      `"${t.reason.replace(/"/g, '""')}"`,
      t.adminEmail,
      t.adminRole,
      new Date(t.timestamp).toISOString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tickletac_currency_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight">Transaction Management & Audit Ledger</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 text-[10px] font-mono font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Immutable Ledger
              </span>
            </div>
            <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
              Complete historical log of all currency additions, deductions, reasons, and administrative actors
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={transactions.length === 0}
              className="px-3.5 py-2 rounded-xl bg-[#0b1424] hover:bg-[#16243d] border border-[#263857] text-xs font-mono font-semibold text-[#eef4fc] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Export filtered records to CSV"
            >
              <Download className="w-4 h-4 text-[#4f8fff]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchTransactions}
              disabled={loading}
              className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Transaction ID, Player ID, Player Name, or Admin Email…"
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs font-mono text-[#eef4fc] rounded-xl pl-9 pr-3 py-2.5 outline-none transition-colors"
            />
            <Search className="w-4 h-4 text-[#889bb6] absolute left-3 top-2.5" />
          </div>

          <div className="md:col-span-2">
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs font-mono text-[#eef4fc] rounded-xl px-3 py-2.5 outline-none transition-colors cursor-pointer"
            >
              <option value="all">Currency: All</option>
              <option value="coins">Coins Only (🪙)</option>
              <option value="diamonds">Diamonds Only (💎)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-[#0b1424] border border-[#263857] focus:border-[#4f8fff] text-xs font-mono text-[#eef4fc] rounded-xl px-3 py-2.5 outline-none transition-colors cursor-pointer"
            >
              <option value="all">Action: All</option>
              <option value="add">Add (+)</option>
              <option value="deduct">Deduct (-)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20 active:scale-[0.98]"
            >
              Filter Ledger
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-[#132038] border border-[#263857] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b1424]/90 border-b border-[#263857] text-[11px] font-mono text-[#889bb6] uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Transaction ID</th>
                <th className="py-3.5 px-4 font-bold">Player</th>
                <th className="py-3.5 px-4 font-bold">Currency</th>
                <th className="py-3.5 px-4 font-bold">Previous</th>
                <th className="py-3.5 px-4 font-bold">Change Applied</th>
                <th className="py-3.5 px-4 font-bold">New Balance</th>
                <th className="py-3.5 px-4 font-bold">Mandatory Reason</th>
                <th className="py-3.5 px-4 font-bold">Authorizing Admin</th>
                <th className="py-3.5 px-4 font-bold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263857]/60 text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#889bb6]">
                    <RefreshCw className="w-6 h-6 text-[#4f8fff] animate-spin mx-auto mb-2" />
                    Loading transaction records…
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#889bb6]">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isAdd = t.action === 'add';
                  return (
                    <tr key={t.id} className="hover:bg-[#192a4a]/60 transition-colors">
                      {/* Transaction ID */}
                      <td className="py-3 px-4 font-bold text-[#4f8fff] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{t.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(t.id, t.id)}
                            className="text-[#889bb6] hover:text-[#eef4fc] p-1 rounded hover:bg-[#16243d]"
                            title="Copy Transaction ID"
                          >
                            {copiedId === t.id ? (
                              <Check className="w-3 h-3 text-[#10b981]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Player */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#eef4fc]">{t.playerId}</div>
                        <div className="text-[10px] text-[#889bb6] font-sans">{t.playerName}</div>
                      </td>

                      {/* Currency */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-[#eef4fc] uppercase flex items-center gap-1">
                          {t.currencyType === 'coins' ? '🪙 COINS' : '💎 DIAMONDS'}
                        </span>
                      </td>

                      {/* Previous Balance */}
                      <td className="py-3 px-4 text-[#889bb6] whitespace-nowrap">
                        {t.previousBalance.toLocaleString()}
                      </td>

                      {/* Change Applied */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            isAdd
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-300 border-red-500/30'
                          }`}
                        >
                          {isAdd ? '+' : '-'}{t.amount.toLocaleString()}
                        </span>
                      </td>

                      {/* New Balance */}
                      <td className="py-3 px-4 text-[#10b981] font-extrabold whitespace-nowrap">
                        {t.newBalance.toLocaleString()}
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 font-sans text-xs text-[#eef4fc] max-w-xs truncate" title={t.reason}>
                        {t.reason}
                      </td>

                      {/* Authorizing Admin */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-[#eef4fc] text-[11px] font-semibold">{t.adminEmail}</div>
                        <div className="text-[10px] text-[#889bb6]">{t.adminRole}</div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-[#889bb6] text-[11px] whitespace-nowrap">
                        {new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
