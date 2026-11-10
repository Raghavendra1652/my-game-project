import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { GameEvent } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Calendar, Plus, RefreshCw, Power, Check, Clock, Sparkles, AlertCircle } from 'lucide-react';

export const EventManagementView: React.FC = () => {
  const { permissions } = useAdminAuth();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New event form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'DOUBLE_COINS' | 'DIAMOND_RUSH' | 'TOURNAMENT' | 'WEEKEND_FRENZY' | 'SEASONAL'>('DOUBLE_COINS');
  const [coinMultiplier, setCoinMultiplier] = useState(2);
  const [diamondBonus, setDiamondBonus] = useState(5);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getEvents();
      setEvents(res.events);
    } catch (e) {
      console.warn('Events load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleToggleActive = async (evt: GameEvent) => {
    try {
      await adminApi.updateEvent(evt.id, { active: !evt.active });
      fetchEvents();
    } catch (e: any) {
      alert(`Toggle failed: ${e.message}`);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      await adminApi.createEvent({
        title: title.trim(),
        description: description.trim(),
        eventType,
        active: true,
        startTime: startMs,
        endTime: endMs,
        rewards: {
          coinMultiplier: eventType === 'DOUBLE_COINS' || eventType === 'WEEKEND_FRENZY' ? coinMultiplier : undefined,
          diamondBonus: eventType === 'DIAMOND_RUSH' ? diamondBonus : undefined,
        },
      });
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      fetchEvents();
    } catch (e: any) {
      alert(`Failed to create event: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Scheduled & Live In-Game Events</span>
          </h2>
          <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
            Configure live event schedules, reward multipliers, and tournament seasons
          </p>
        </div>

        <div className="flex items-center gap-2">
          {permissions?.canManageEvents && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Event</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchEvents}
            className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-xs font-mono text-[#889bb6]">Loading events…</div>
        ) : events.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-xs font-mono text-[#889bb6]">No active or scheduled events found.</div>
        ) : (
          events.map((evt) => {
            const isNowActive = evt.active && Date.now() >= evt.startTime && Date.now() <= evt.endTime;
            return (
              <div
                key={evt.id}
                className={`p-5 rounded-2xl bg-[#132038] border flex flex-col justify-between transition-all ${
                  isNowActive ? 'border-[#10b981] shadow-lg shadow-emerald-500/5' : 'border-[#263857]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#16243d] border border-[#263857] text-[#889bb6] uppercase">
                      {evt.eventType}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        evt.active
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                    >
                      {evt.active ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-[#eef4fc]">{evt.title}</h3>
                  <p className="text-xs text-[#889bb6] mt-1 line-clamp-2">{evt.description}</p>

                  {/* Rewards Breakdown */}
                  <div className="mt-4 p-3 rounded-xl bg-[#0b1424] border border-[#263857] text-xs font-mono space-y-1">
                    <div className="text-[10px] text-[#889bb6] uppercase font-bold">Configured Multipliers:</div>
                    {evt.rewards.coinMultiplier && (
                      <div className="text-[#fbbf24] font-bold">🪙 {evt.rewards.coinMultiplier}x Coin Victory Multiplier</div>
                    )}
                    {evt.rewards.diamondBonus && (
                      <div className="text-[#38bdf8] font-bold">💎 +{evt.rewards.diamondBonus} Bonus Diamonds / Mission</div>
                    )}
                    {evt.rewards.specialSymbol && (
                      <div className="text-purple-300 font-bold">✨ Cosmetic Reward: {evt.rewards.specialSymbol}</div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#263857] flex items-center justify-between text-[11px] font-mono text-[#889bb6]">
                  <div>
                    <div>Start: {new Date(evt.startTime).toLocaleDateString()}</div>
                    <div>End: {new Date(evt.endTime).toLocaleDateString()}</div>
                  </div>

                  {permissions?.canManageEvents && (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(evt)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                        evt.active
                          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {evt.active ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#08101f]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#132038] border-2 border-[#263857] rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#263857]">
              <h3 className="text-base font-extrabold text-[#eef4fc]">Configure New Game Event</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-[#889bb6] hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekend Double Coins Mania"
                  className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Event Type *</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                  className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-2.5 outline-none cursor-pointer"
                >
                  <option value="DOUBLE_COINS">DOUBLE COINS (Multiplier on Match Win)</option>
                  <option value="DIAMOND_RUSH">DIAMOND RUSH (Bonus Diamonds on Quests)</option>
                  <option value="TOURNAMENT">TOURNAMENT (Competitive Bracket Season)</option>
                  <option value="WEEKEND_FRENZY">WEEKEND FRENZY (Double XP & Coins)</option>
                  <option value="SEASONAL">SEASONAL (Custom Theme Event)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#889bb6] font-bold uppercase mb-1">Coin Multiplier</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={coinMultiplier}
                    onChange={(e) => setCoinMultiplier(parseInt(e.target.value || '1', 10))}
                    className="w-full bg-[#0b1424] border border-[#263857] text-[#fbbf24] font-bold rounded-xl p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#889bb6] font-bold uppercase mb-1">Diamond Bonus</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={diamondBonus}
                    onChange={(e) => setDiamondBonus(parseInt(e.target.value || '0', 10))}
                    className="w-full bg-[#0b1424] border border-[#263857] text-[#38bdf8] font-bold rounded-xl p-2.5 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#889bb6] font-bold uppercase mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#889bb6] font-bold uppercase mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-2.5 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Player-facing announcement description…"
                  className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-2.5 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#263857] text-[#889bb6] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold"
                >
                  {submitting ? 'Creating…' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
