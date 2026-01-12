"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { db } from "@/lib/db";

interface User {
  id: string;
  email: string;
  full_name?: string;
  onboardingCompleted?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  logout: (shouldRedirect?: boolean) => void;
  setSessionUser: (user: User | null) => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let mePromise: Promise<User | null> | null = null;

async function fetchMeOnce(): Promise<User | null> {
  if (!mePromise) {
    mePromise = db.auth.me().then((u) => u as User).catch(() => null);
  }
  return mePromise;
}

function setMeCache(user: User | null) {
  mePromise = Promise.resolve(user);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  const setSessionUser = (nextUser: User | null) => {
    setMeCache(nextUser);
    setUser(nextUser);
    setIsLoadingAuth(false);
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setMeCache(next);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingAuth(true);
      const me = await fetchMeOnce();
      if (cancelled) return;
      setUser(me);
      setIsLoadingAuth(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = (shouldRedirect = true) => {
    setSessionUser(null);

    if (shouldRedirect) {
      db.auth.logout();
    } else {
      db.auth.logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        logout,
        setSessionUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
