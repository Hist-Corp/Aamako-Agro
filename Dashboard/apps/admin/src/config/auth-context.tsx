'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, Role } from '@aamako/shared-types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, totpCode?: string, role?: Role) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount — only trust real backend tokens,
  // validated against /auth/me. No local-only sessions allowed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      if (!accessToken && !refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        const { apiClient } = await import('@/lib/api-client');
        if (accessToken) apiClient.setAccessToken(accessToken);
        const me = await apiClient.get<{
          id: string;
          email: string;
          role: Role;
          name?: string;
          firstName?: string;
          lastName?: string;
          mfaEnabled?: boolean;
          lastLoginAt?: string;
          createdAt?: string;
        }>('/auth/me');
        if (!cancelled) {
          setUser({
            id: me.id,
            email: me.email,
            role: me.role,
            name: me.name
              || `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim()
              || me.email,
            mfaEnabled: !!me.mfaEnabled,
            lastLoginAt: me.lastLoginAt || new Date().toISOString(),
            createdAt: me.createdAt || new Date().toISOString(),
          });
        }
      } catch {
        // Token invalid/expired and refresh failed — clear the session.
        if (!cancelled) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, totpCode?: string, _role?: Role) => {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    // Authenticate strictly against the real backend — no local/demo bypass.
    const { apiClient } = await import('@/lib/api-client');
    try {
      // Backend shape: { accessToken, refreshToken, user: { id, email, role } }
      const response = await apiClient.post<{
        accessToken?: string;
        refreshToken?: string;
        tokens?: { accessToken: string; refreshToken: string };
        user: { id: string; email: string; role: Role; [k: string]: unknown };
      }>('/auth/login', { email, password, totpCode });

      const accessToken = response.accessToken ?? response.tokens?.accessToken;
      const refreshToken = response.refreshToken ?? response.tokens?.refreshToken;
      if (!accessToken) throw new Error('Login response missing access token');

      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken || '');
      apiClient.setAccessToken(accessToken);
      const realUser: User = {
        id: response.user.id,
        email: response.user.email,
        role: response.user.role,
        // Backend login returns {id,email,role} only — fill dashboard display fields.
        name: (response.user as any).name
          || (`${(response.user as any).firstName ?? ''} ${(response.user as any).lastName ?? ''}`.trim())
          || response.user.email,
        mfaEnabled: !!((response.user as any).mfaEnabled ?? false),
        lastLoginAt: (response.user as any).lastLoginAt || new Date().toISOString(),
        createdAt: (response.user as any).createdAt || new Date().toISOString(),
      };
      setUser(realUser);
    } catch (err: any) {
      // Surface backend errors (invalid credentials, etc.) to the UI.
      throw err instanceof Error ? err : new Error('Login failed. Please check your credentials.');
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      try {
        const { ROLE_PERMISSIONS } = require('@aamako/shared-types');
        return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
      } catch {
        return false; // Fail closed when permissions cannot be determined
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
