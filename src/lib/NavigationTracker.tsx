"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/db";

export default function NavigationTracker() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

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

  // Log user activity when navigating to a page
  useEffect(() => {
    if (!pathname) return;

    let pageName = "Home";

    if (pathname !== "/" && pathname !== "") {
      // Remove leading slash and get the first segment
      const pathSegment = pathname.replace(/^\//, "").split("/")[0];
      // Capitalize first letter
      pageName = pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1);
    }

    if (isAuthenticated && pageName) {
      db.appLogs.logUserInApp(pageName).catch(() => {
        // Silently fail - logging shouldn't break the app
      });
    }
  }, [pathname, isAuthenticated]);

  return null;
}
