"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { db } from "@/lib/db";
import { usePathname, useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: any;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: (shouldRedirect?: boolean) => void;
  navigateToLogin: () => void;
  refreshUser: (options?: { force?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  const lastMeFetchAtRef = useRef<number>(0);
  const meFetchInFlightRef = useRef<Promise<void> | null>(null);
  const checkUserAuthRef = useRef<
    (options?: { force?: boolean }) => Promise<void>
  >(async () => {});

  // Custom auth uses httpOnly JWT cookies. There is no client-side auth provider
  // subscription; we only sync state by calling /api/me after login/logout.

  useEffect(() => {
    // Check auth on mount AND on navigation.
    // This ensures that if we redirect from login -> dashboard, we pick up the new session.
    // Important: do not force /api/me during invite link processing.
    // The invite page establishes a Supabase session client-side first.
    if (pathname.startsWith("/invite")) {
      // IMPORTANT: /invite must render immediately for unauthenticated visitors.
      // We intentionally skip /api/me here to avoid timing issues while the page
      // consumes the Supabase email-link tokens. But we still need to end the
      // global loading state, otherwise the layout blocks the page forever.
      setIsLoadingAuth(false);
      return;
    }

    checkUserAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Polling to keep status fresh (every 5 seconds)
  useEffect(() => {
    // Only poll if we are already authenticated to avoid spamming 401s
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      // Force a background refresh without setting global loading state
      checkUserAuth({ force: true, background: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // Mock public settings
      setIsLoadingPublicSettings(false);

      await checkUserAuth();
    } catch (error: any) {
      console.error("Unexpected error:", error);
      setAuthError({
        type: "unknown",
        message: error.message || "An unexpected error occurred",
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async (options?: {
    force?: boolean;
    background?: boolean;
  }) => {
    try {
      const force = options?.force ?? false;
      const isBackground = options?.background ?? false;
      const now = Date.now();
      // Short cache (2 seconds) to ensure navigation always verifies status
      const staleMs = 2000;

      if (!force && user && now - lastMeFetchAtRef.current < staleMs) {
        setIsLoadingAuth(false);
        return;
      }

      if (meFetchInFlightRef.current) {
        await meFetchInFlightRef.current;
        return;
      }

      // Only show loading spinner if we don't have a user yet and this isn't a background poll.
      if (!user && !isBackground) {
        setIsLoadingAuth(true);
      }

      meFetchInFlightRef.current = (async () => {
        const currentUser = await db.auth.me();

        // Central Guard Logic: Enforce Client Status
        // We do this immediately after fetching the user to ensure no flicker or leak.
        if (currentUser.role === "client") {
          const s = currentUser.status;
          const p = window.location.pathname;

          // If blocked/deleted/inactive, redirect to access page.
          // If active, ensure we are NOT on an access page.
          if (s === "PENDING" && !p.startsWith("/access/pending")) {
            router.replace("/access/pending");
          } else if (s === "PENDING_LIMIT" && !p.startsWith("/access/pending-limit")) {
            router.replace("/access/pending-limit");
          } else if (s === "INACTIVE" && !p.startsWith("/access/inactive")) {
            router.replace("/access/inactive");
          } else if (s === "BLOCKED" && !p.startsWith("/access/blocked")) {
            router.replace("/access/blocked");
          } else if ((s === "DELETED" || s === "ARCHIVED") && !p.startsWith("/access/deleted")) {
            router.replace("/access/deleted");
          } else if (s === "ACTIVE" && p.startsWith("/access/")) {
            router.replace("/dashboard");
          }
        }

        lastMeFetchAtRef.current = Date.now();
        // Only update state if something changed to prevent re-renders?
        // React's setUser handles shallow equality but objects are new references.
        // For now, simpler to set it.
        setUser(currentUser);
        setIsAuthenticated(true);
        if (!isBackground) setIsLoadingAuth(false);
      })();

      await meFetchInFlightRef.current;
      meFetchInFlightRef.current = null;
    } catch (error: any) {
      meFetchInFlightRef.current = null;
      // Don't clear auth state on background polling errors (e.g. network blip)
      // unless it's strictly a 401/403.
      const status = typeof error?.status === "number" ? error.status : null;

      if (
        status === 401 ||
        status === 403 ||
        error?.message === "Unauthorized"
      ) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setUser(null);
      } else if (!options?.background) {
        setIsLoadingAuth(false);
      }

      // If the session is invalid OR the server actively forbids access (blocked client),
      // immediately clear the auth cookie and return the user to the login screen.
      if (
        error?.message === "Unauthorized" ||
        status === 401 ||
        status === 403
      ) {
        setAuthError({
          type: "auth_required",
          message: "Authentication required",
        });

        // For 403 (typically blocked client), we MUST clear the cookie and leave dashboard.
        // Use POST so we can clear cookie without a navigation race, then push login.
        if (status === 403 && typeof window !== "undefined") {
          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
            });
          } catch {
            // best effort
          }

          if (!window.location.pathname.startsWith("/auth")) {
            // Redirect to appropriate access page if blocked?
            // Actually, for 403 generated by requireAppUser (CLIENT_BLOCKED),
            // the user might be completely blocked from the platform.
            window.location.href =
              "/auth/client?authError=" + encodeURIComponent("Access denied.");
          }
          return;
        }

        // Do NOT redirect if we are on the invite page or other public pages
        if (
          pathname !== "/" &&
          !pathname.startsWith("/invite") &&
          !pathname.startsWith("/public") &&
          !pathname.startsWith("/auth")
        ) {
          router.replace("/auth");
        }
      }
    }
  };

  // Keep a fresh reference for the Supabase auth subscription callback.
  useEffect(() => {
    checkUserAuthRef.current = checkUserAuth;
  });

  const login = async () => {
    await db.auth.login();
  };

  const register = async () => {
    await db.auth.register();
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      db.auth.logout();
    } else {
      db.auth.logout();
    }
  };

  const navigateToLogin = () => {
    router.push("/auth");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        login,
        register,
        logout,
        navigateToLogin,
        refreshUser: (options?: { force?: boolean }) =>
          checkUserAuthRef.current(options),
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
