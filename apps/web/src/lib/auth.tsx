"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getOrgId, getToken, setOrgId, setToken } from "./api";
import type { Organization } from "./types";

type User = { id: string; email: string; full_name: string };

type AuthState = {
  user: User | null;
  orgs: Organization[];
  orgId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
  }) => Promise<void>;
  logout: () => void;
  selectOrg: (id: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setOrgs([]);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/api/auth/me");
      const organizations = await api<Organization[]>("/api/auth/organizations");
      setUser(me);
      setOrgs(organizations);
      const saved = getOrgId();
      const next =
        organizations.find((o) => o.id === saved)?.id ||
        organizations[0]?.id ||
        null;
      setOrgIdState(next);
      setOrgId(next);
    } catch {
      setToken(null);
      setUser(null);
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    setLoading(true);
    await refresh();
  };

  const register = async (payload: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
  }) => {
    const data = await api<{ access_token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(data.access_token);
    setLoading(true);
    await refresh();
  };

  const logout = () => {
    setToken(null);
    setOrgId(null);
    setUser(null);
    setOrgs([]);
    setOrgIdState(null);
  };

  const selectOrg = (id: string) => {
    setOrgId(id);
    setOrgIdState(id);
  };

  const value = useMemo(
    () => ({
      user,
      orgs,
      orgId,
      loading,
      login,
      register,
      logout,
      selectOrg,
      refresh,
    }),
    [user, orgs, orgId, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
