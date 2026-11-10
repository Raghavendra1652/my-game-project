import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { Trophy, Medal, RefreshCw, TrendingUp, Users, Target, ArrowUpRight } from 'lucide-react';

export const LeaderboardReportsView: React.FC = () => {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReportTab, setActiveReportTab] = useState<'rankings' | 'winloss' | 'activity'>('rankings');

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getLeaderboards();
      setRankings(res.rankings);
    } catch (e) {
      console.warn('Leaderboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#fbbf24]" />
            <span>Leaderboards & Analytics Reports</span>
          </h2>
          <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
            Player competitive rankings, win/loss distributions, and player activity intelligence
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRankings}
          className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
        </button>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex items-center gap-3 border-b border-[#263857] pb-1 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveReportTab('rankings')}
          className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
            activeReportTab === 'rankings'
              ? 'bg-[#4f8fff]/20 text-[#4f8fff] border border-[#4f8fff]/30'
              : 'text-[#889bb6] hover:text-[#eef4fc]'
          }`}
        >
          🏆 Global Player Rankings (XP)
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('winloss')}
          className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
            activeReportTab === 'winloss'
              ? 'bg-[#4f8fff]/20 text-[#4f8fff] border border-[#4f8fff]/30'
              : 'text-[#889bb6] hover:text-[#eef4fc]'
          }`}
        >
          🎯 Win/Loss Performance
        </button>
      </div>

      {/* Rankings Table */}
      <div className="bg-[#132038] border border-[#263857] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0b1424]/90 border-b border-[#263857] text-[11px] text-[#889bb6] uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Rank</th>
                <th className="py-3.5 px-4 font-bold">Player</th>
                <th className="py-3.5 px-4 font-bold">Player ID</th>
                <th className="py-3.5 px-4 font-bold">Level</th>
                <th className="py-3.5 px-4 font-bold">Total XP</th>
                <th className="py-3.5 px-4 font-bold">Victories</th>
                <th className="py-3.5 px-4 font-bold">Total Matches</th>
                <th className="py-3.5 px-4 font-bold">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263857]/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#889bb6]">Loading rankings…</td>
                </tr>
              ) : rankings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#889bb6]">No ranking records found.</td>
                </tr>
              ) : (
                rankings.map((r, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                  return (
                    <tr key={r.uid} className="hover:bg-[#192a4a]/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-sm whitespace-nowrap">{medal}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{r.av || '🙂'}</span>
                          <span className="font-bold text-[#eef4fc] font-sans">{r.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#4f8fff] font-bold whitespace-nowrap">{r.playerId}</td>
                      <td className="py-3.5 px-4 text-[#eef4fc] whitespace-nowrap">Lv {r.lvl}</td>
                      <td className="py-3.5 px-4 text-[#fbbf24] font-bold whitespace-nowrap">{r.xp.toLocaleString()} XP</td>
                      <td className="py-3.5 px-4 text-[#10b981] font-bold whitespace-nowrap">{r.wins}W</td>
                      <td className="py-3.5 px-4 text-[#889bb6] whitespace-nowrap">{r.games}G</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#0b1424] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#4f8fff] h-full" style={{ width: `${r.winRate}%` }}></div>
                          </div>
                          <span className="font-bold text-[#eef4fc]">{r.winRate}%</span>
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
