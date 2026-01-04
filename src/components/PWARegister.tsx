"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    // Avoid service worker caching headaches in dev.
    if (process.env.NODE_ENV !== "production") return;

    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Intentionally no-op.
      });
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      // iOS Safari PWAs
      (window.navigator as any).standalone === true ||
      // Standard
      window.matchMedia?.("(display-mode: standalone)")?.matches === true;

    if (!isStandalone) return;

    const blurActive = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;

      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        (el as HTMLInputElement).blur?.();
      }
    };

    // Let the initial render settle, then blur.
    const t = window.setTimeout(blurActive, 50);

    // Also handle app returning to foreground.
    const onVis = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(blurActive, 0);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
