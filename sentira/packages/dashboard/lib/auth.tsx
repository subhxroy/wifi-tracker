"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";


interface AuthContextValue {
  user: { id: string; name: string; role: string } | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => undefined,
  signOut: () => undefined,
});

export function useAuth() {
  return useContext(AuthContext);
}

const STORAGE_KEY = "sentira_auth";

interface StoredUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored) as StoredUser);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = useCallback(async (email: string) => {
    const storedUser: StoredUser = {
      id: `cg_${email.replace(/[@.]/g, "_")}`,
      name: email.split("@")[0] ?? "Caregiver",
      role: "Caregiver",
      email,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedUser));
    setUser(storedUser);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
