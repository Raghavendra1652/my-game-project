import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { AdminUser, AdminRole } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShieldAlert, UserPlus, RefreshCw, Trash2, Key, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

const ROLE_DESCRIPTIONS: Record<AdminRole, { title: string; desc: string; badge: string }> = {
  SUPER_ADMIN: {
    title: 'Super Admin',
    desc: 'Full administrative access, staff authorization, currency & audit management',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  GAME_ADMIN: {
    title: 'Game Admin',
    desc: 'Player management, currency adjustments, rewards & live events',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  SUPPORT_STAFF: {
    title: 'Support Staff',
    desc: 'Player lookup, account inspection, and approved compensation actions',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  MODERATOR: {
    title: 'Moderator',
    desc: 'Player lookup, incident reports, and account suspension restrictions',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  ANALYST: {
    title: 'Analyst',
    desc: 'Read-only access to player statistics, circulation charts & leaderboard reports',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
};

export const StaffManagementView: React.FC = () => {
  const { adminUser } = useAdminAuth();
  const [staffList, setStaffList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New staff form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('SUPPORT_STAFF');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getStaff();
      setStaffList(res.staff);
    } catch (e: any) {
      console.warn('Staff fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    if (newEmail.trim().toLowerCase() === adminUser?.email.toLowerCase()) {
      setErrorMessage('Security constraint: You cannot modify your own administrative role or self-promote.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await adminApi.saveStaff({
        email: newEmail.trim(),
        name: newName.trim() || undefined,
        role: newRole,
      });
      setShowAddModal(false);
      setNewEmail('');
      setNewName('');
      fetchStaff();
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to save staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (email: string) => {
    if (email.toLowerCase() === adminUser?.email.toLowerCase()) {
      alert('Security constraint: You cannot revoke or delete your own Super Admin access.');
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke administrative access for ${email}?`)) {
      return;
    }

    try {
      await adminApi.removeStaff(email);
      fetchStaff();
    } catch (e: any) {
      alert(`Revoke failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-400" />
            <span>Staff Administration & Role Permissions</span>
          </h2>
          <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
            Role-based authorization registry with self-promotion guards (Super Admin only)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Authorize Staff Member</span>
          </button>

          <button
            type="button"
            onClick={fetchStaff}
            className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.keys(ROLE_DESCRIPTIONS) as AdminRole[]).map((r) => {
          const info = ROLE_DESCRIPTIONS[r];
          return (
            <div key={r} className="p-3.5 rounded-xl bg-[#132038] border border-[#263857] space-y-1.5">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${info.badge}`}>
                {r}
              </span>
              <div className="font-bold text-xs text-[#eef4fc] mt-1">{info.title}</div>
              <p className="text-[11px] text-[#889bb6] line-clamp-2 leading-relaxed">{info.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Staff Table */}
      <div className="bg-[#132038] border border-[#263857] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0b1424]/90 border-b border-[#263857] text-[11px] text-[#889bb6] uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Staff Member</th>
                <th className="py-3.5 px-4 font-bold">Account Email</th>
                <th className="py-3.5 px-4 font-bold">Assigned Role</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Created Date</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263857]/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#889bb6]">Loading staff registry…</td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#889bb6]">No staff registered.</td>
                </tr>
              ) : (
                staffList.map((s) => {
                  const isCurrent = s.email.toLowerCase() === adminUser?.email.toLowerCase();
                  return (
                    <tr key={s.email} className="hover:bg-[#192a4a]/50 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#eef4fc] font-sans flex items-center gap-2">
                          <span>{s.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#889bb6] whitespace-nowrap">{s.email}</td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ROLE_DESCRIPTIONS[s.role]?.badge || 'border-gray-500'}`}>
                          {s.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-emerald-300 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Active
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#889bb6] whitespace-nowrap text-[11px]">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {isCurrent ? (
                          <span className="text-[10px] text-[#889bb6] italic">Protected self</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRevoke(s.email)}
                            className="p-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Revoke staff authorization"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorize Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#08101f]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#132038] border-2 border-[#263857] rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#263857]">
              <h3 className="text-base font-extrabold text-[#eef4fc]">Authorize New Administrator</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-[#889bb6] hover:text-white">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Staff Google / Account Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. staff.member@company.com"
                  className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Staff Member Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jordan Lee"
                  className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[#889bb6] font-bold uppercase mb-1">Assigned Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-[#0b1424] border border-[#263857] text-[#eef4fc] rounded-xl p-2.5 outline-none cursor-pointer"
                >
                  <option value="GAME_ADMIN">GAME_ADMIN (Player management, Currency, Rewards)</option>
                  <option value="SUPPORT_STAFF">SUPPORT_STAFF (Player lookup & Approved compensation)</option>
                  <option value="MODERATOR">MODERATOR (Player reports & Account suspension)</option>
                  <option value="ANALYST">ANALYST (Read-only statistics & reports)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full administrative access)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#0b1424] border border-[#263857] text-[11px] text-[#889bb6]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 inline mr-1" />
                <span>Zero self-promotion rule: Only Super Admins can configure accounts. Staff cannot alter their own role.</span>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#263857] text-[#889bb6] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#4f8fff] hover:bg-[#3b82f6] text-white font-bold"
                >
                  {submitting ? 'Authorizing…' : 'Save Authorization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
