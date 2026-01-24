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
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
const APP_VERSION_KEY = "progrr_app_version";

if (!APP_VERSION) {
  throw new Error("NEXT_PUBLIC_APP_VERSION is missing");
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


function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/b")
  );
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isVersionReady, setIsVersionReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    "loading" | "guest" | "authenticated"
  >("loading");
  const didFetchMeRef = useRef(false);
  const versionCheckRef = useRef(false);
  const redirectingRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  const setSessionUser = (nextUser: User | null) => {
    setUser(nextUser);
    setIsLoadingAuth(false);
    setAuthStatus(nextUser ? "authenticated" : "guest");
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      return next;
    });
  };

  const logout = React.useCallback(async (shouldRedirect = true) => {
    setSessionUser(null);

    if (shouldRedirect) {
      db.auth.logout();
    } else {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Ignore.
      }
    }
  }, []);

  useEffect(() => {
    if (versionCheckRef.current) return;
    versionCheckRef.current = true;

    if (typeof window === "undefined") {
      setIsVersionReady(true);
      return;
    }
    const storedVersion = window.localStorage.getItem(APP_VERSION_KEY);
    if (storedVersion && storedVersion !== APP_VERSION) {
      redirectingRef.current = true;
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {
        // ignore
      });
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
      try {
        window.sessionStorage.clear();
      } catch {
        // ignore
      }
      try {
        window.localStorage.setItem(APP_VERSION_KEY, APP_VERSION ?? "");
      } catch {
        // ignore
      }
      window.location.href = "/login";
      return;
    }

    if (!storedVersion) {
      try {
        window.localStorage.setItem(APP_VERSION_KEY, APP_VERSION ?? "");
      } catch {
        // ignore
      }
    }
    setIsVersionReady(true);
  }, []);

  useEffect(() => {
    writeAuthCache(user);
  }, [user]);

  useEffect(() => {
    if (!isVersionReady) return;
    if (redirectingRef.current) return;
    if (isPublicPath(pathname)) {
      setIsLoadingAuth(false);
      setAuthStatus(user ? "authenticated" : "guest");
      return;
    }
    if (didFetchMeRef.current) return;
    didFetchMeRef.current = true;

    (async () => {
      setIsLoadingAuth(true);
      setAuthStatus("loading");
      try {
        const res = await db.auth.me();
        let nextUser: User | null = null;
        if (res && typeof res === "object" && (res as any).user) {
          nextUser = {
            ...((res as any).user as User),
            business: (res as any).business,
          } as User;
        } else {
          nextUser = res as User | null;
        }

        setUser(nextUser);
        setAuthStatus(nextUser ? "authenticated" : "guest");
      } catch (err: any) {
        const status = typeof err?.status === "number" ? err.status : undefined;
        const message = String(err?.message || "");
        const inferred =
          status ?? (message === "Unauthorized" ? 401 : undefined);
        const isUnauthorized = inferred === 401;

        setUser(null);
        setAuthStatus(isUnauthorized ? "guest" : "guest");
      } finally {
        setIsLoadingAuth(false);
      }
    })();
  }, [isVersionReady, pathname, user]);

  useEffect(() => {
    if (!isVersionReady) return;
    if (redirectingRef.current) return;
    if (!isLoadingAuth && !user && !isPublicPath(pathname)) {
      router.replace("/auth");
    }
  }, [isLoadingAuth, isVersionReady, pathname, router, user]);

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
