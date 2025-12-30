"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { db } from '@/lib/db';
import { useRouter } from 'next/navigation';

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
  login: (email: string, password: string) => Promise<User>;
  register: (userData: any) => Promise<User>;
  logout: (shouldRedirect?: boolean) => void;
  navigateToLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to get initial state synchronously
const getStoredSession = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const session = localStorage.getItem('progrr_session');
    return session ? JSON.parse(session) : null;
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Initialize from local storage on mount (client-side only)
    const storedUser = getStoredSession();
    if (storedUser) {
      setUser(storedUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    }
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // Mock public settings
      setIsLoadingPublicSettings(false);

      await checkUserAuth();
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Check for dev_role parameter or session storage
      const params = new URLSearchParams(window.location.search);
      let devRole = params.get('dev_role');
      
      if (devRole) {
        sessionStorage.setItem('dev_role', devRole);
      } else {
        devRole = sessionStorage.getItem('dev_role');
      }

      if (devRole) {
        const mockUser = devRole === 'admin' ? {
          id: 'dev-admin',
          email: 'admin@progrr.local',
          full_name: 'Dev Admin',
          role: 'admin'
        } : {
          id: 'dev-client',
          email: 'client@progrr.local',
          full_name: 'Dev Client',
          role: 'client'
        };
        
        setUser(mockUser);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        return;
      }

      // Now check if the user is authenticated
      // We already initialized from localStorage, but let's verify with the "backend" (mock db)
      if (!user) setIsLoadingAuth(true);
      
      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error: any) {
      // Only log unexpected errors
      if (error.message !== 'Not authenticated') {
        console.error('User auth check failed:', error);
      }

      setIsLoadingAuth(false);
      if (!getStoredSession()) {
          setIsAuthenticated(false);
          setUser(null);
      }
      
      // If user auth fails, it might be an expired token or just not logged in
      if (error.status === 401 || error.status === 403 || error.message === 'Not authenticated') {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const login = async (email: string, password: string) => {
    const user = await db.auth.login(email, password);
    setUser(user);
    setIsAuthenticated(true);
    return user;
  };

  const register = async (userData: any) => {
    const user = await db.auth.register(userData);
    setUser(user);
    setIsAuthenticated(true);
    return user;
  };

  const logout = (shouldRedirect = true) => {
    sessionStorage.removeItem('dev_role');
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      if (sessionStorage.getItem('dev_role')) {
         window.location.href = '/';
      } else {
         db.auth.logout();
         router.push('/');
      }
    } else {
      db.auth.logout();
    }
  };

  const navigateToLogin = () => {
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      login,
      register,
      logout,
      navigateToLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
