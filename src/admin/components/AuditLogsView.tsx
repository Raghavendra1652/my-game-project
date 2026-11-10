import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { AuditLogItem } from '../types/admin';
import { FileText, Shield, Search, RefreshCw, Filter, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs();
      setLogs(res.logs);
    } catch (e) {
      console.warn('Audit logs load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = logs.filter((l) => (categoryFilter === 'all' ? true : l.category === categoryFilter));

  return (
    <div className="space-y-6">
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#4f8fff]" />
            <span>Immutable Administrative Audit Trail</span>
          </h2>
          <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
            Cryptographic non-repudiation records for all sensitive operations, currency transactions, and account changes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#0b1424] border border-[#263857] text-xs font-mono text-[#eef4fc] rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">Category: All Events</option>
            <option value="CURRENCY">Currency Adjustments</option>
            <option value="AUTH">Authentication Events</option>
            <option value="PLAYER">Player Restrictions</option>
            <option value="SHOP">Shop Modifications</option>
            <option value="EVENT">Game Events</option>
            <option value="STAFF">Staff Permission Changes</option>
            <option value="REWARDS">Compensation Dispatches</option>
          </select>

          <button
            type="button"
            onClick={fetchLogs}
            className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#132038] border border-[#263857] rounded-2xl overflow-hidden shadow-lg">
        <div className="divide-y divide-[#263857]/60 font-mono text-xs">
          {loading ? (
            <div className="text-center py-12 text-[#889bb6]">Loading audit trail…</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-[#889bb6]">No audit logs found for category '{categoryFilter}'.</div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <div key={log.id} className="p-4 hover:bg-[#192a4a]/40 transition-colors">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-[#0b1424] border border-[#263857] flex items-center justify-center text-xs text-[#4f8fff] shrink-0">
                        <Shield className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#eef4fc] text-sm">{log.action}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#16243d] border border-[#263857] text-[#889bb6]">
                            {log.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#889bb6] mt-0.5">
                          Actor: <span className="text-[#eef4fc]">{log.adminEmail}</span> ({log.adminRole})
                          {log.targetId && (
                            <>
                              {' '}
                              • Target: <span className="text-[#4f8fff]">{log.targetId}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[#889bb6]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="px-2.5 py-1 rounded bg-[#0b1424] hover:bg-[#16243d] border border-[#263857] text-[11px] text-[#889bb6] hover:text-white transition-colors cursor-pointer"
                      >
                        {isExpanded ? 'Hide Details' : 'View Payload'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON details */}
                  {isExpanded && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#08101f] border border-[#263857] text-[11px] text-emerald-300 font-mono relative animate-fade-in">
                      <div className="flex justify-between items-center pb-2 mb-2 border-b border-[#263857]/50 text-[#889bb6]">
                        <span>Log ID: {log.id}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(JSON.stringify(log.details, null, 2), log.id)}
                          className="flex items-center gap-1 text-[#889bb6] hover:text-white"
                        >
                          {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Copy Payload</span>
                        </button>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
