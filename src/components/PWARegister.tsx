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

  return null;
}
