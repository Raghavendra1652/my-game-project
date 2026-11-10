import React from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  LayoutDashboard,
  Users,
  Coins,
  History,
  Gift,
  ShoppingBag,
  Calendar,
  Trophy,
  ShieldAlert,
  FileText,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  | 'players'
  | 'currency'
  | 'transactions'
  | 'rewards'
  | 'shop'
  | 'events'
  | 'leaderboards'
  | 'staff'
  | 'audit';

interface SidebarProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export const AdminSidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { adminUser, permissions } = useAdminAuth();

  if (!adminUser || !permissions) return null;

  const NAV_ITEMS: Array<{
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    permissionKey?: keyof typeof permissions;
    badge?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'players', label: 'Player Management', icon: Users },
    {
      id: 'currency',
      label: 'Currency Adjustments',
      icon: Coins,
      permissionKey: 'canAdjustCurrency',
      badge: 'Critical',
    },
    { id: 'transactions', label: 'Transaction History', icon: History },
    { id: 'rewards', label: 'Reward Management', icon: Gift },
    { id: 'shop', label: 'Shop Management', icon: ShoppingBag, permissionKey: 'canManageShop' },
    { id: 'events', label: 'Event Management', icon: Calendar, permissionKey: 'canManageEvents' },
    { id: 'leaderboards', label: 'Leaderboard & Reports', icon: Trophy },
    { id: 'staff', label: 'Staff Management', icon: ShieldAlert, permissionKey: 'canManageStaff' },
    { id: 'audit', label: 'Security Audit Logs', icon: FileText, permissionKey: 'canViewAuditLogs' },
  ];

  return (
    <aside className="w-64 bg-[#132038] border-r border-[#263857] flex flex-col shrink-0 select-none">
      {/* Navigation menu */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-[#889bb6] font-bold">
          Operations Navigation
        </div>

        {NAV_ITEMS.map((item) => {
          const isAllowed = !item.permissionKey || permissions[item.permissionKey];
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          if (!isAllowed) {
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-[#889bb6]/40 cursor-not-allowed opacity-50"
                title={`Locked: Requires permissions not granted to ${adminUser.role}`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                <span className="text-[10px] font-mono uppercase">Locked</span>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#4f8fff]/20 to-[#4f8fff]/5 text-[#4f8fff] border border-[#4f8fff]/40 shadow-sm'
                  : 'text-[#889bb6] hover:text-[#eef4fc] hover:bg-[#192a4a] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#4f8fff]' : 'text-[#889bb6]'}`} />
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/30">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#4f8fff]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer info */}
      <div className="p-3.5 border-t border-[#263857] bg-[#0b1424]/60">
        <div className="flex items-center justify-between text-[11px] text-[#889bb6] font-mono">
          <span>Active Role</span>
          <span className="text-[#4f8fff] font-bold">{adminUser.role}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#263857]/60 flex items-center justify-between text-[11px] text-[#889bb6]">
          <span>Player Game</span>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#eef4fc] hover:text-[#4f8fff] font-semibold flex items-center gap-1"
          >
            Open Lobby &rarr;
          </a>
        </div>
      </div>
    </aside>
  );
};
