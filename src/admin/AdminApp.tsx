import React, { useState } from 'react';
import { useAdminAuth } from './context/AdminAuthContext';
import { AdminLoginView } from './components/AdminLoginView';
import { AdminHeader } from './components/AdminHeader';
import { AdminSidebar, AdminTab } from './components/AdminSidebar';
import { DashboardView } from './components/DashboardView';
import { PlayerManagementView } from './components/PlayerManagementView';
import { CurrencyAdjustmentView } from './components/CurrencyAdjustmentView';
import { TransactionHistoryView } from './components/TransactionHistoryView';
import { RewardManagementView } from './components/RewardManagementView';
import { ShopManagementView } from './components/ShopManagementView';
import { EventManagementView } from './components/EventManagementView';
import { LeaderboardReportsView } from './components/LeaderboardReportsView';
import { StaffManagementView } from './components/StaffManagementView';
import { AuditLogsView } from './components/AuditLogsView';
import { PlayerDetailModal } from './components/PlayerDetailModal';
import { PlayerAccount } from './types/admin';
import { RefreshCw } from 'lucide-react';

export const AdminApp: React.FC = () => {
  const { adminUser, isLoading } = useAdminAuth();
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');

  // Cross-component workflow state
  const [currencyTargetPid, setCurrencyTargetPid] = useState<string>('');
  const [rewardTargetPid, setRewardTargetPid] = useState<string>('');
  const [playersSearchQuery, setPlayersSearchQuery] = useState<string>('');
  const [inspectedPlayer, setInspectedPlayer] = useState<PlayerAccount | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b1424] flex items-center justify-center">
        <div className="text-center space-y-3 font-mono">
          <RefreshCw className="w-8 h-8 text-[#4f8fff] animate-spin mx-auto" />
          <div className="text-xs text-[#889bb6]">Checking administrator session…</div>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLoginView />;
  }

  // Navigation handlers
  const handleNavigateToPlayers = (query?: string) => {
    if (query) setPlayersSearchQuery(query);
    setCurrentTab('players');
  };

  const handleNavigateToCurrency = (pid?: string) => {
    if (pid) setCurrencyTargetPid(pid);
    setCurrentTab('currency');
  };

  const handleNavigateToRewards = (pid?: string) => {
    if (pid) setRewardTargetPid(pid);
    setCurrentTab('rewards');
  };

  const handleNavigateToTransactions = () => {
    setCurrentTab('transactions');
  };

  return (
    <div className="min-h-screen bg-[#0b1424] text-[#eef4fc] flex flex-col font-sans">
      {/* Admin Top Header */}
      <AdminHeader
        onOpenQuickAdjust={() => {
          setCurrencyTargetPid('');
          setCurrentTab('currency');
        }}
      />

      {/* Main Workspace with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AdminSidebar currentTab={currentTab} onTabChange={setCurrentTab} />

        {/* View Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                onNavigateToPlayers={handleNavigateToPlayers}
                onNavigateToCurrency={handleNavigateToCurrency}
                onNavigateToTransactions={handleNavigateToTransactions}
              />
            )}

            {currentTab === 'players' && (
              <PlayerManagementView
                initialSearchQuery={playersSearchQuery}
                onInspectPlayer={(p) => setInspectedPlayer(p)}
                onAdjustCurrencyForPlayer={handleNavigateToCurrency}
                onIssueRewardForPlayer={handleNavigateToRewards}
              />
            )}

            {currentTab === 'currency' && (
              <CurrencyAdjustmentView
                initialPlayerId={currencyTargetPid}
                onViewTransactionHistory={handleNavigateToTransactions}
              />
            )}

            {currentTab === 'transactions' && <TransactionHistoryView />}

            {currentTab === 'rewards' && <RewardManagementView initialPlayerId={rewardTargetPid} />}

            {currentTab === 'shop' && <ShopManagementView />}

            {currentTab === 'events' && <EventManagementView />}

            {currentTab === 'leaderboards' && <LeaderboardReportsView />}

            {currentTab === 'staff' && <StaffManagementView />}

            {currentTab === 'audit' && <AuditLogsView />}
          </div>
        </main>
      </div>

      {/* Player Detail Drawer / Modal */}
      {inspectedPlayer && (
        <PlayerDetailModal
          player={inspectedPlayer}
          onClose={() => setInspectedPlayer(null)}
          onOpenCurrencyAdjust={handleNavigateToCurrency}
          onOpenCompensation={handleNavigateToRewards}
        />
      )}
    </div>
  );
};
