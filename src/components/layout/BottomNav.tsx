"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutDashboard, Settings, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n/useI18n";

import { ONBOARDING_QUERY_KEY } from "@/hooks/useOnboardingSettings";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { t } = useI18n();

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
    { label: t("nav.dashboard"), icon: LayoutDashboard, href: "/dashboard" },
    { label: t("nav.calendar"), icon: Calendar, href: "/calendar" },
    { label: t("nav.customers"), icon: Users, href: "/customers" },
    { label: t("nav.settings"), icon: Settings, href: "/settings" },
  ];

  return (
    <nav
      data-bottom-nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_8px_-1px_rgba(0,0,0,0.02)]"
    >
      <div className="mx-auto max-w-[420px] h-14 flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => refreshForHref(item.href)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center space-y-1 h-full tap-highlight-transparent",
                isActive
                  ? "text-[#165CF0] font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className="h-6 w-6"
                strokeWidth={isActive ? 2.5 : 2}
                aria-hidden="true"
              />
              <span className="text-[10px] sm:text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
