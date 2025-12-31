"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getCookie, setCookie } from "@/lib/client-cookies";

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = getCookie("progrr_dark_mode");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    setCookie("progrr_dark_mode", darkMode ? "true" : "false", {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
