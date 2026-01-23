"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutDashboard, Settings, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { ONBOARDING_QUERY_KEY } from "@/hooks/useOnboardingSettings";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const refreshForHref = React.useCallback(
    (href: string) => {
      // Mark relevant cached data as stale so the destination page refetches.
      if (href.startsWith("/dashboard")) {
        queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        queryClient.invalidateQueries({ queryKey: ["dashboardRevenueSeries"] });
        return;
      }

      if (href.startsWith("/calendar")) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        return;
      }

      if (href.startsWith("/customers")) {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        return;
      }

      if (href.startsWith("/settings")) {
        queryClient.invalidateQueries({ queryKey: ["business"] });
        queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
      }
    },
    [queryClient]
  );

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { name: "Calendar", icon: Calendar, href: "/calendar" },
    { name: "Customers", icon: Users, href: "/customers" },
    { name: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <nav
      data-bottom-nav
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-background border-border pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-[480px] h-[72px] flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => refreshForHref(item.href)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center space-y-1 h-full py-3 tap-highlight-transparent",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className="h-6 w-6"
                strokeWidth={isActive ? 2.5 : 2}
                aria-hidden="true"
              />
              <span className="text-[10px] sm:text-xs">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
