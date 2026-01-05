"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

type IncomingEvent = {
  type?: string;
  adminId?: string;
  clientId?: string;
  messageId?: string;
};

export default function MessagesRealtime() {
  const { user, isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) return;

    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;

      // Ensure only one connection from this component instance.
      if (es) {
        try {
          es.close();
        } catch {
          // ignore
        }
      }

      // Same-origin EventSource sends cookies automatically.
      es = new EventSource("/api/messages/stream");

      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data || "{}") as IncomingEvent;
          if (parsed?.type && String(parsed.type).startsWith("message:")) {
            // Refetch messages. This is event-based (no polling) and will refetch active queries once.
            queryClient.invalidateQueries({ queryKey: ["messages"] });
            queryClient.invalidateQueries({ queryKey: ["myMessages"] });
          }
        } catch {
          // ignore
        }
      };

      es.addEventListener("ready", () => {
        // no-op
      });

      es.onerror = () => {
        // EventSource auto-reconnects, but some browsers/proxies get stuck.
        // Close and re-open once to recover; no background loops beyond reconnect-on-error.
        try {
          es?.close();
        } catch {
          // ignore
        }
        es = null;

        if (!closed) {
          window.setTimeout(() => {
            if (!closed) connect();
          }, 1500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      try {
        es?.close();
      } catch {
        // ignore
      }
      es = null;
    };
    // Reconnect when switching admin (coach), because the cookie/adminId changes.
  }, [isLoadingAuth, user, queryClient]);

  return null;
}
