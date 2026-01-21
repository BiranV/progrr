"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { db } from "@/lib/db";
import { usePathname, useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  full_name?: string;
  onboardingCompleted?: boolean;
  business?: {
    trialStartAt?: string;
    trialEndAt?: string;
    subscriptionStatus?: "trial" | "active" | "expired";
  };
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authStatus: "loading" | "guest" | "authenticated";
  logout: (shouldRedirect?: boolean) => Promise<void> | void;
  setSessionUser: (user: User | null) => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CACHE_KEY = "progrr:auth-cache:v1";

function readAuthCache(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: User } | null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed.user ?? null;
  } catch {
    return null;
  }
}

function writeAuthCache(user: User | null) {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
      return;
    }
    window.localStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({ user, updatedAt: Date.now() }),
    );
  } catch {
    // Ignore cache errors.
  }
}

type MeResult = { user: User | null; status?: number };

let meResultPromise: Promise<MeResult> | null = null;

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/b")
  );
}

async function fetchMeOnce(): Promise<MeResult> {
  if (!meResultPromise) {
    meResultPromise = db.auth
      .me()
      .then((u) => {
        if (u && typeof u === "object" && (u as any).user) {
          const merged = {
            ...((u as any).user as User),
            business: (u as any).business,
          } as User;
          return { user: merged };
        }
        return { user: u as User };
      })
      .catch((err: any) => {
        const status = typeof err?.status === "number" ? err.status : undefined;
        const message = String(err?.message || "");
        const inferred =
          status ?? (message === "Unauthorized" ? 401 : undefined);
        return { user: null, status: inferred };
      });
  }
  return meResultPromise;
}

function setMeCache(user: User | null) {
  meResultPromise = Promise.resolve({ user, status: user ? undefined : 401 });
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const initialUser = React.useMemo(() => readAuthCache(), []);
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authStatus, setAuthStatus] = useState<
    "loading" | "guest" | "authenticated"
  >(initialUser ? "authenticated" : "loading");
  const didFetchMeRef = useRef(false);
  const mountedRef = useRef(true);
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  const setSessionUser = (nextUser: User | null) => {
    setMeCache(nextUser);
    setUser(nextUser);
    setIsLoadingAuth(false);
    setAuthStatus(nextUser ? "authenticated" : "guest");
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
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    writeAuthCache(user);
  }, [user]);

  useEffect(() => {
    // Fully public booking pages must never call /api/me.
    if (pathname.startsWith("/b")) {
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setIsLoadingAuth(false);
        setAuthStatus(user ? "authenticated" : "guest");
      });
      return;
    }

    // Fetch /api/me at most once per app session.
    if (didFetchMeRef.current) return;
    didFetchMeRef.current = true;

    (async () => {
      setIsLoadingAuth(true);
      setAuthStatus("loading");
      const res = await fetchMeOnce();
      if (!mountedRef.current) return;

      if (res.status === 401) {
        setMeCache(null);
        setUser(null);
        setIsLoadingAuth(false);
        setAuthStatus("guest");

        if (!isPublicPath(pathname)) {
          router.replace("/auth");
        }
        return;
      }

      setUser(res.user);
      setIsLoadingAuth(false);
      setAuthStatus(res.user ? "authenticated" : "guest");
    })();
  }, [pathname, router, user]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (user) return;

    if (!isPublicPath(pathname)) {
      router.replace("/auth");
    }
  }, [isLoadingAuth, pathname, router, user]);

  const logout = async (shouldRedirect = true) => {
    setSessionUser(null);

    if (shouldRedirect) {
      db.auth.logout();
    } else {
      // Clear cookie server-side without forcing a full page navigation.
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Ignore.
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authStatus,
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
