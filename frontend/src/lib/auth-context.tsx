'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, projectsAPI, User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  orgId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, orgName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const orgId = user?.organizations?.[0]?.id ?? null;

  const bootstrap = useCallback(async (savedToken: string) => {
    try {
      const me = await authAPI.me(savedToken);
      setUser(me);
      setToken(savedToken);
    } catch {
      localStorage.removeItem('cg_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cg_token');
    if (saved) {
      bootstrap(saved);
    } else {
      setLoading(false);
    }
  }, [bootstrap]);

  const login = async (email: string, password: string) => {
    const data = await authAPI.login(email, password);
    localStorage.setItem('cg_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, firstName: string, orgName: string) => {
    const data = await authAPI.register({ email, password, first_name: firstName, organization_name: orgName });
    localStorage.setItem('cg_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('cg_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, orgId, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
