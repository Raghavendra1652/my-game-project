import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser, AdminPermissions, AdminRole, ROLE_PERMISSIONS } from '../types/admin';
import { adminApi } from '../services/api';

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  permissions: AdminPermissions | null;
  isLoading: boolean;
  error: string | null;
  loginWithRole: (role: AdminRole) => Promise<void>;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  switchRoleForTesting: (role: AdminRole) => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkExistingSession = async () => {
      const token = adminApi.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { user, permissions: perms } = await adminApi.getCurrentUser();
        setAdminUser(user);
        setPermissions(perms);
      } catch (e: any) {
        console.warn('Session check failed, clearing token:', e);
        adminApi.setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const loginWithRole = async (role: AdminRole) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.login({ demoRole: role });
      setAdminUser(res.user);
      setPermissions(res.permissions);
    } catch (e: any) {
      setError(e.message || 'Failed to authenticate');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogleToken = async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.login({ idToken });
      setAdminUser(res.user);
      setPermissions(res.permissions);
    } catch (e: any) {
      setError(e.message || 'Administrator authorization failed for this Google account');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const switchRoleForTesting = async (role: AdminRole) => {
    await loginWithRole(role);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await adminApi.logout();
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      setAdminUser(null);
      setPermissions(null);
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        permissions,
        isLoading,
        error,
        loginWithRole,
        loginWithGoogleToken,
        logout,
        clearError,
        switchRoleForTesting,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
