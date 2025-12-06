import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AdminLoginResult } from '../types';

interface AdminContextValue {
  admin: AdminLoginResult['admin'] | null;
  token: string | null;
  setAuth: (auth: { admin: AdminLoginResult['admin']; token: string } | null) => void;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminLoginResult['admin'] | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('adminAuth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { token: string; admin: AdminLoginResult['admin'] };
        setToken(parsed.token);
        setAdmin(parsed.admin);
      } catch {
        // ignore
      }
    }
  }, []);

  // Use useCallback to stabilize the setAuth function reference
  const setAuth = useCallback((auth: { admin: AdminLoginResult['admin']; token: string } | null) => {
    if (!auth) {
      setToken(null);
      setAdmin(null);
      window.localStorage.removeItem('adminAuth');
    } else {
      setToken(auth.token);
      setAdmin(auth.admin);
      window.localStorage.setItem('adminAuth', JSON.stringify(auth));
    }
  }, []);

  // Use useMemo to stabilize the context value object reference
  const value = useMemo(() => ({ admin, token, setAuth }), [admin, token, setAuth]);

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
};

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}


