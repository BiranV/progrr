"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function NavigationTracker() {
  const pathname = usePathname();

  // Post navigation changes to parent window
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.parent?.postMessage(
        {
          type: "app_changed_url",
          url: window.location.href,
        },
        "*"
      );
    }
  }, [pathname]);

  // Intentionally no in-app activity logging here.
  // (Legacy SaaS logging was removed during the refactor.)

  return null;
}
