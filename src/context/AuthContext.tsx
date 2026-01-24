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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEV_ONBOARDING_COOKIE, DEV_ONBOARDING_USER_ID } from "@/lib/dev-onboarding";

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
  logout: () => Promise<void>;
  setSessionUser: (user: User | null) => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION as string;

const APP_VERSION_KEY = "progrr_app_version";

if (!APP_VERSION) {
  throw new Error("NEXT_PUBLIC_APP_VERSION is missing");
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authStatus, setAuthStatus] = useState<
    "loading" | "guest" | "authenticated"
  >("loading");

  const versionCheckedRef = useRef(false);
  const meFetchedRef = useRef(false);
  const redirectingRef = useRef(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isDevOnboarding =
    process.env.NODE_ENV === "development" &&
    (searchParams.get("devOnboarding") === "true" ||
      typeof document !== "undefined" &&
      document.cookie.includes(`${DEV_ONBOARDING_COOKIE}=1`)) &&
    pathname.startsWith("/onboarding");

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  /* ======================
     VERSION GUARD (ONCE)
     ====================== */
  useEffect(() => {
    if (versionCheckedRef.current) return;
    versionCheckedRef.current = true;

    const stored = localStorage.getItem(APP_VERSION_KEY);

    if (stored !== APP_VERSION) {
      redirectingRef.current = true;

      try {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
      } catch { }

      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).finally(() => {
        window.location.replace("/login");
      });

      return;
    }

    if (!stored) {
      try {
        localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
      } catch { }
    }
  }, []);

  /* ======================
     FETCH /me (ONCE)
     ====================== */
  useEffect(() => {
    if (redirectingRef.current) return;
    if (meFetchedRef.current) return;

    if (isDevOnboarding) {
      const devUser: User = {
        id: DEV_ONBOARDING_USER_ID,
        email: "dev@local",
        full_name: "Dev Onboarding",
        onboardingCompleted: false,
        role: "owner",
      } as any;
      setUser(devUser);
      setIsLoadingAuth(false);
      setAuthStatus("authenticated");
      return;
    }

    if (isPublicPath(pathname)) {
      setIsLoadingAuth(false);
      setAuthStatus(user ? "authenticated" : "guest");
      return;
    }

    meFetchedRef.current = true;

    (async () => {
      setIsLoadingAuth(true);
      setAuthStatus("loading");

      try {
        const res = await db.auth.me();

        const nextUser =
          res && typeof res === "object" && (res as any).user
            ? { ...(res as any).user, business: (res as any).business }
            : (res as User | null);

        setUser(nextUser);
        setAuthStatus(nextUser ? "authenticated" : "guest");
      } catch {
        setUser(null);
        setAuthStatus("guest");
      } finally {
        setIsLoadingAuth(false);
      }
    })();
  }, [pathname]);

  /* ======================
     PROTECTED ROUTES
     ====================== */
  useEffect(() => {
    if (redirectingRef.current) return;
    if (isLoadingAuth) return;

    if (isDevOnboarding) return;

    if (!user && !isPublicPath(pathname)) {
      router.replace("/auth");
    }
  }, [isLoadingAuth, user, pathname, router, isDevOnboarding]);

  /* ======================
     ACTIONS
     ====================== */
  const logout = async () => {
    setUser(null);
    setAuthStatus("guest");
    setIsLoadingAuth(false);

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { }

    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
    }).catch(() => { });

    window.location.replace("/login");
  };

  const setSessionUser = (next: User | null) => {
    setUser(next);
    setAuthStatus(next ? "authenticated" : "guest");
    setIsLoadingAuth(false);
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
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
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
