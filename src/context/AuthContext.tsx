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

  const checkUserAuth = async (options?: { force?: boolean }) => {
    try {
      const force = options?.force ?? false;
      const now = Date.now();
      const staleMs = 5 * 60 * 1000;

      if (!force && user && now - lastMeFetchAtRef.current < staleMs) {
        setIsLoadingAuth(false);
        return;
      }

      if (meFetchInFlightRef.current) {
        await meFetchInFlightRef.current;
        return;
      }

      // Only show loading spinner if we don't have a user yet.
      // This prevents "flicker" when navigating between protected pages.
      if (!user) {
        setIsLoadingAuth(true);
      }

      meFetchInFlightRef.current = (async () => {
        const currentUser = await db.auth.me();
        lastMeFetchAtRef.current = Date.now();
        setUser(currentUser);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
      })();

      await meFetchInFlightRef.current;
      meFetchInFlightRef.current = null;
    } catch (error: any) {
      meFetchInFlightRef.current = null;
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);

      if (error?.message === "Unauthorized" || error?.status === 401) {
        setAuthError({
          type: "auth_required",
          message: "Authentication required",
        });

        // Do NOT redirect if we are on the invite page or other public pages
        if (
          pathname !== "/" &&
          !pathname.startsWith("/invite") &&
          !pathname.startsWith("/public") &&
          !pathname.startsWith("/auth")
        ) {
          router.replace("/");
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
    router.push("/");
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
