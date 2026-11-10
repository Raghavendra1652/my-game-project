import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminRole } from '../types/admin';
import { Shield, Lock, UserCheck, AlertTriangle, Key, ExternalLink, Sparkles } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const ROLES_INFO: Array<{
  role: AdminRole;
  title: string;
  desc: string;
  email: string;
  badgeColor: string;
}> = [
  {
    role: 'SUPER_ADMIN',
    title: 'Super Admin',
    desc: 'Full administrative access, staff authorization, currency & audit management',
    email: 'raghavalarence300@gmail.com',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  {
    role: 'GAME_ADMIN',
    title: 'Game Admin',
    desc: 'Player management, currency adjustments, rewards & live events',
    email: 'gameadmin@tickletac.internal',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    role: 'SUPPORT_STAFF',
    title: 'Support Staff',
    desc: 'Player lookup, account inspection, and approved compensation actions',
    email: 'support@tickletac.internal',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    role: 'MODERATOR',
    title: 'Moderator',
    desc: 'Player lookup, incident reports, and account suspension restrictions',
    email: 'mod@tickletac.internal',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    role: 'ANALYST',
    title: 'Analyst',
    desc: 'Read-only access to player statistics, circulation charts & leaderboard reports',
    email: 'analyst@tickletac.internal',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
];

export const AdminLoginView: React.FC = () => {
  const { loginWithRole, loginWithGoogleToken, error, isLoading, clearError } = useAdminAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authErrorNotice, setAuthErrorNotice] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setAuthErrorNotice(null);
    clearError();
    try {
      const cfg = {
        apiKey: 'AIzaSyA2pYtJd7dCnpkjpwSknvKWcG7uFrC2Mts',
        authDomain: 'project-r-64a0b.firebaseapp.com',
        projectId: 'project-r-64a0b',
      };
      const app = initializeApp(cfg, 'AdminAuthClient');
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await loginWithGoogleToken(idToken);
    } catch (e: any) {
      console.warn('Google Sign-In failed or popup closed:', e);
      setAuthErrorNotice(
        e.code === 'auth/popup-closed-by-user'
          ? 'Sign-in window was closed. Please try again or select an authorized staff role below.'
          : e.message || 'Google authentication failed'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRoleLogin = async (role: AdminRole) => {
    setAuthErrorNotice(null);
    clearError();
    try {
      await loginWithRole(role);
    } catch (e: any) {
      setAuthErrorNotice(e.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1424] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-[#4f8fff]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-[#ff5a43]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-[#132038] border-2 border-[#263857] rounded-2xl shadow-2xl overflow-hidden relative z-10 backdrop-blur-md">
        {/* Header banner */}
        <div className="p-8 pb-6 border-b border-[#263857] bg-gradient-to-b from-[#192a4a]/80 to-[#132038]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#4f8fff] to-[#2563eb] flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
                  TICKLE-TAC <span className="text-[#4f8fff] text-sm uppercase px-2.5 py-0.5 rounded-full bg-[#4f8fff]/15 border border-[#4f8fff]/30 font-mono">Admin Portal</span>
                </h1>
                <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
                  Enterprise Player Operations & Currency Ledger v2.4
                </p>
              </div>
            </div>

            <a
              href="/"
              className="text-xs text-[#889bb6] hover:text-[#eef4fc] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#263857] hover:bg-[#192a4a] transition-all"
            >
              Back to Game <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="bg-[#0b1424]/80 border border-[#263857] rounded-xl p-3.5 flex items-start gap-3 mt-4 text-xs text-[#889bb6]">
            <Lock className="w-4 h-4 text-[#fbbf24] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#eef4fc]">Zero-Trust Server Authorization:</span> Access is strictly enforced on the backend via Firebase claims and role verification. Client-side flags and local storage are never trusted for sensitive database actions.
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-6">
          {(error || authErrorNotice) && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">Authentication Refused</div>
                <div className="text-xs text-red-300/90 mt-0.5">{error || authErrorNotice}</div>
              </div>
            </div>
          )}

          {/* Primary Google Login Button */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#889bb6] font-semibold mb-2">
              Sign In with Authorized Google Account
            </label>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || isLoading}
              className="w-full py-3.5 px-5 rounded-xl bg-[#eef4fc] hover:bg-white text-[#0b1424] font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{googleLoading ? 'Verifying with Google…' : 'Continue with Google Account'}</span>
            </button>
            <p className="text-[11px] text-[#889bb6] text-center mt-2">
              The project owner (<span className="text-[#eef4fc] font-mono">raghavalarence300@gmail.com</span>) is pre-authorized as <b className="text-purple-300">Super Admin</b>.
            </p>
          </div>

          <div className="relative flex items-center justify-center my-6">
            <div className="border-t border-[#263857] w-full" />
            <span className="bg-[#132038] px-3 text-xs font-mono uppercase tracking-wider text-[#889bb6] absolute">
              or select staff role for immediate RBAC testing
            </span>
          </div>

          {/* Quick Staff Role Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#889bb6] font-mono mb-1">
              <span>AUTHORIZED STAFF PROFILES</span>
              <span>PERMISSION TIERS</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {ROLES_INFO.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => handleRoleLogin(r.role)}
                  disabled={isLoading}
                  className="w-full text-left p-3.5 rounded-xl border border-[#263857] hover:border-[#4f8fff]/60 bg-[#0b1424]/70 hover:bg-[#192a4a] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#16243d] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <UserCheck className="w-4 h-4 text-[#4f8fff]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#eef4fc] group-hover:text-[#4f8fff] transition-colors">
                          {r.title}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${r.badgeColor}`}>
                          {r.role}
                        </span>
                      </div>
                      <div className="text-xs text-[#889bb6] line-clamp-1 mt-0.5">
                        {r.desc}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-[#4f8fff] font-bold group-hover:underline flex items-center gap-1">
                      Sign In &rarr;
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0b1424] border-t border-[#263857] flex items-center justify-between text-[11px] font-mono text-[#889bb6]">
          <span>Security Protocol: Firebase Custom Claims + Ledger Idempotency</span>
          <span>Tickle-Tac Ops Engine</span>
        </div>
      </div>
    </div>
  );
};
