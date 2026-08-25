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

// Demo mock users for preview without backend
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'superadmin@aamako.com': {
    password: 'admin123',
    user: {
      id: 'demo-1',
      email: 'superadmin@aamako.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN' as Role,
      mfaEnabled: true,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 31536000000).toISOString(),
    },
  },
  'admin@aamako.com': {
    password: 'admin123',
    user: {
      id: 'demo-2',
      email: 'admin@aamako.com',
      name: 'Admin User',
      role: 'ADMIN' as Role,
      mfaEnabled: false,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 25920000000).toISOString(),
    },
  },
  'manager@aamako.com': {
    password: 'manager123',
    user: {
      id: 'demo-3',
      email: 'manager@aamako.com',
      name: 'Operations Manager',
      role: 'MANAGER' as Role,
      mfaEnabled: false,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 15768000000).toISOString(),
    },
  },
  'sales@aamako.com': {
    password: 'sales123',
    user: {
      id: 'demo-4',
      email: 'sales@aamako.com',
      name: 'Ram Sales',
      role: 'SALES' as Role,
      mfaEnabled: false,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 7884000000).toISOString(),
    },
  },
  'inventory@aamako.com': {
    password: 'inventory123',
    user: {
      id: 'demo-5',
      email: 'inventory@aamako.com',
      name: 'Gita Manager',
      role: 'INVENTORY_MANAGER' as Role,
      mfaEnabled: false,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 5184000000).toISOString(),
    },
  },
  'content@aamako.com': {
    password: 'content123',
    user: {
      id: 'demo-6',
      email: 'content@aamako.com',
      name: 'Hari Editor',
      role: 'CONTENT_MANAGER' as Role,
      mfaEnabled: false,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 3153600000).toISOString(),
    },
  },
  'support@aamako.com': {
    password: 'support123',
    user: {
      id: 'demo-7',
      email: 'support@aamako.com',
      name: 'Sita Support',
      role: 'CUSTOMER_SUPPORT' as Role,
      mfaEnabled: false,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 1576800000).toISOString(),
    },
  },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES: 'Sales',
  INVENTORY_MANAGER: 'Inventory Manager',
  CONTENT_MANAGER: 'Content Manager',
  CUSTOMER_SUPPORT: 'Customer Support',
  // Real backend roles
  STAFF_ADMIN: 'Staff Admin',
  STAFF_MANAGER: 'Staff Manager',
  STAFF_SALES: 'Staff Sales',
  STAFF_SUPPORT: 'Staff Support',
  RETAIL_CUSTOMER: 'Retail Customer',
  WHOLESALE_CUSTOMER: 'Wholesale Customer',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const saved = localStorage.getItem('demo_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('demo_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, _totpCode?: string, _role?: Role) => {
    // Try real API first
    try {
      const { apiClient } = await import('@/lib/api-client');
      // Backend shape: { accessToken, refreshToken, user: { id, email, role } }
      const response = await apiClient.post<{
        accessToken?: string;
        refreshToken?: string;
        tokens?: { accessToken: string; refreshToken: string };
        user: { id: string; email: string; role: Role; [k: string]: unknown };
      }>('/auth/login', { email, password, totpCode: _totpCode });

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
      // A real backend login replaces any prior demo session.
      localStorage.removeItem('demo_user');
      setUser(realUser);
      return;
    } catch {
      // Fall through to demo mode
    }

    // Demo mode: accept any email/password combo
    const effectiveRole = _role || 'SUPER_ADMIN';
    const demoMatch = DEMO_USERS[email.toLowerCase()];
    const demoUser: User = demoMatch?.password === password
      ? { ...demoMatch.user, role: effectiveRole, name: ROLE_LABELS[effectiveRole] || effectiveRole }
      : {
          id: 'demo-' + Date.now(),
          email,
          name: ROLE_LABELS[effectiveRole] || email.split('@')[0],
          role: effectiveRole,
          mfaEnabled: false,
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    setUser(demoUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('demo_user');
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
        return true; // In demo mode, grant all permissions
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
