"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LocaleProvider } from "@/context/LocaleContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

export default function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: "en" | "he";
}) {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "progrr:rq-cache:v1",
    });

    persistQueryClient({
      queryClient,
      persister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: "v1",
    });
  }, []);

  React.useEffect(() => {
    fetch("/api/health", { method: "GET" }).catch(() => {
      // Ignore warmup failures.
    });
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider initialLanguage={initialLanguage}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
