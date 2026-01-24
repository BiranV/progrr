"use client";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { AuthProvider } from "@/context/AuthContext";
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
}: {
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem("progrr_dark_mode");
      window.localStorage.removeItem("progrr:rq-cache:v1");
    } catch {
      // ignore
    }

    try {
      document.cookie = "progrr_lang=; Max-Age=0; path=/";
    } catch {
      // ignore
    }

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "progrr-rq-cache:v1",
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
    <Suspense fallback={null}>
      <AuthProvider>
        <LocaleProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </LocaleProvider>
      </AuthProvider>
    </Suspense>
  );
}
