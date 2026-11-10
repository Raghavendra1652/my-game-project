import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminRole } from '../types/admin';
import { Shield, LogOut, ExternalLink, ChevronDown, Check, UserCircle, Bell, Database } from 'lucide-react';

const ROLE_COLORS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  GAME_ADMIN: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  SUPPORT_STAFF: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  MODERATOR: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  ANALYST: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
};

const ALL_ROLES: AdminRole[] = ['SUPER_ADMIN', 'GAME_ADMIN', 'SUPPORT_STAFF', 'MODERATOR', 'ANALYST'];

export const AdminHeader: React.FC<{ onOpenQuickAdjust?: () => void }> = ({ onOpenQuickAdjust }) => {
  const { adminUser, logout, switchRoleForTesting } = useAdminAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  if (!adminUser) return null;

  return (
    <header className="h-16 bg-[#132038] border-b border-[#263857] px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
      {/* Left: Brand & DB connectivity */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#4f8fff] to-[#2563eb] flex items-center justify-center shadow-md shadow-blue-500/20 border border-blue-400/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-[#eef4fc] flex items-center gap-2">
              TICKLE-TAC <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-[#4f8fff]/20 text-[#4f8fff] border border-[#4f8fff]/40 font-bold">Admin Panel</span>
            </div>
            <div className="text-[11px] text-[#889bb6] font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>Live Firestore:</span>
              <span className="text-[#eef4fc] font-semibold">project-r-64a0b</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Actions, Role Selector & User Profile */}
      <div className="flex items-center gap-3">
        {/* Quick launch player game */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#263857] bg-[#0b1424] hover:bg-[#192a4a] text-xs font-semibold text-[#889bb6] hover:text-[#eef4fc] transition-all"
          title="Open Tickle-Tac player game in a new tab"
        >
          <span>🎮 Launch Game</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Role Switcher for Testing RBAC */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#263857] bg-[#0b1424] hover:bg-[#192a4a] text-xs font-mono transition-all cursor-pointer"
            title="Switch staff role for permission testing"
          >
            <span className="text-[#889bb6]">Role:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${ROLE_COLORS[adminUser.role]}`}>
              {adminUser.role}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#889bb6]" />
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#132038] border border-[#263857] rounded-xl shadow-2xl p-2 z-50">
              <div className="text-[10px] font-mono uppercase text-[#889bb6] px-2.5 py-1.5 font-bold">
                Switch Staff Role (Test RBAC)
              </div>
              <div className="space-y-1">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      switchRoleForTesting(role);
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                      adminUser.role === role ? 'bg-[#192a4a] text-[#4f8fff] font-bold' : 'text-[#889bb6] hover:bg-[#192a4a] hover:text-[#eef4fc]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${role === 'SUPER_ADMIN' ? 'bg-purple-400' : role === 'GAME_ADMIN' ? 'bg-blue-400' : role === 'SUPPORT_STAFF' ? 'bg-emerald-400' : role === 'MODERATOR' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                      {role}
                    </span>
                    {adminUser.role === role && <Check className="w-3.5 h-3.5 text-[#4f8fff]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-[#263857]">
          <div className="w-8 h-8 rounded-full bg-[#16243d] border border-[#263857] flex items-center justify-center text-sm font-bold text-[#eef4fc]">
            {adminUser.name.charAt(0)}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-bold text-[#eef4fc] line-clamp-1">{adminUser.name}</div>
            <div className="text-[10px] font-mono text-[#889bb6] line-clamp-1">{adminUser.email}</div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={logout}
          className="p-2 rounded-lg border border-[#263857] bg-[#0b1424] hover:bg-red-500/10 hover:border-red-500/40 text-[#889bb6] hover:text-red-300 transition-all cursor-pointer"
          title="Sign out of Admin Panel"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
