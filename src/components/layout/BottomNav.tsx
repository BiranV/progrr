"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutDashboard, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { name: "Calendar", icon: Calendar, href: "/calendar" },
    { name: "Customers", icon: Users, href: "/customers" },
    { name: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <nav
      data-bottom-nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background border-border pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-[480px] h-16 flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center space-y-1 h-full py-2 tap-highlight-transparent",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] sm:text-xs">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
