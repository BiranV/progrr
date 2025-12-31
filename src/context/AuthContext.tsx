"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
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

  useEffect(() => {
    // Check auth on mount AND on navigation.
    // This ensures that if we redirect from login -> dashboard, we pick up the new session.
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

  const checkUserAuth = async () => {
    try {
      // Only show loading spinner if we don't have a user yet.
      // This prevents "flicker" when navigating between protected pages.
      if (!user) {
        setIsLoadingAuth(true);
      }

      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error: any) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);

      if (error?.message === "Unauthorized" || error?.status === 401) {
        setAuthError({
          type: "auth_required",
          message: "Authentication required",
        });

        if (pathname !== "/") {
          router.replace("/");
        }
      }
    }
  };

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
