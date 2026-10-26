"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CustomerAccount } from "@/lib/types";
import * as api from "@/lib/client";

interface AuthContextValue {
  customer: CustomerAccount | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .fetchMe()
      .then((c) => active && setCustomer(c))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setCustomer(await api.loginCustomer({ email, password }));
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; name: string; phone?: string }) => {
      setCustomer(await api.registerCustomer(input));
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logoutCustomer();
    setCustomer(null);
  }, []);

  return (
    <AuthContext.Provider value={{ customer, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
