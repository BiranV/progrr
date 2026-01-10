"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import NavigationTracker from "@/lib/NavigationTracker";
import VisualEditAgent from "@/lib/VisualEditAgent";
import MessagesRealtime from "@/components/messages/MessagesRealtime";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardList,
  UtensilsCrossed,
  Calendar,
  MessageSquare,
  Apple,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoadingAuth: loading, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderAuthSpinner = () => {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-300" />
          {/* <div className="text-sm text-gray-600 dark:text-gray-300">
            Loading…
          </div> */}
        </div>
      </div>
    );
  };

  const isAuthEntryPath =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login");

  useEffect(() => {
    if (loading) return;

    // If authenticated, never allow auth entry routes to render.
    if (user && isAuthEntryPath) {
      router.replace("/dashboard");
    }
  }, [isAuthEntryPath, loading, router, user]);

  const settingsOwnerId =
    user?.role === "client"
      ? String(user?.adminId ?? "")
      : String(user?.id ?? "");

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings", settingsOwnerId],
    queryFn: () => db.entities.AppSettings.list(),
    enabled: Boolean(user) && Boolean(settingsOwnerId),
  });

  const { data: allMessages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: () => db.entities.Message.list("-created_date"),
    enabled: Boolean(user) && user?.role === "admin",
  });

  const unreadMessagesCount = React.useMemo(() => {
    if (!user || user.role !== "admin") return 0;

    return (allMessages as any[]).filter((m) => {
      const isSystem = Boolean(m?.isSystemMessage);
      return !m?.readByAdmin && (m?.senderRole === "client" || isSystem);
    }).length;
  }, [allMessages, user]);

  // Filter out blob URLs that might cause errors
  const rawLogoUrl = settings.length > 0 ? (settings[0] as any).logoUrl : null;
  const logoUrl =
    typeof rawLogoUrl === "string" && rawLogoUrl.startsWith("blob:")
      ? null
      : rawLogoUrl;

  const logoShape =
    settings.length > 0 && (settings[0] as any)?.logoShape === "circle"
      ? "circle"
      : "square";
  const logoShapeClass = logoShape === "circle" ? "rounded-full" : "rounded-none";

  const handleLogout = async () => {
    logout();
  };

  if (loading) {
    return renderAuthSpinner();
  }

  // Client-side hard guard: avoid rendering auth pages inside the authenticated shell.
  if (user && isAuthEntryPath) {
    return null;
  }

  // OWNER LAYOUT
  if (user?.role === "owner") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow border-b dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                O
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white">
                Owner Console
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    );
  }

  // Public pages (no layout)
  if (!user || pathname === "/") {
    // SECURITY: If user is not logged in, ONLY render content for known public paths.
    // This prevents "flash of unauthenticated content" if middleware fails or during client-side redirects.
    const isPublic =
      pathname === "/" ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/public") ||
      pathname.startsWith("/invite") ||
      pathname.startsWith("/auth"); // Add other public paths if needed

    if (!user && !isPublic) {
      // Render a spinner while we wait for navigation to /auth.
      // This prevents a "flash" of a previously cached/visible protected screen.
      return renderAuthSpinner();
    }

    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // CLIENT LAYOUT: No sidebar, no admin navigation.
  if (user.role === "client") {
    // Hard client-side guard: prevent clients from entering admin-only routes
    // even if they type the URL manually.
    const adminOnlyPrefixes = [
      "/clients",
      "/plans",
      "/exercises",
      "/foods",
      "/meals",
      "/meetings",
      "/settings",
      "/boards",
      "/board",
      "/analytics",
    ];

    if (adminOnlyPrefixes.some((p) => pathname.startsWith(p))) {
      router.replace("/dashboard");
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {children}
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  const navItems = isAdmin
    ? [
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { name: "Clients", icon: Users, href: "/clients" },
      { name: "Exercises", icon: Dumbbell, href: "/exercises" },
      { name: "Workout Plans", icon: ClipboardList, href: "/plans" },
      { name: "Foods", icon: Apple, href: "/foods" },
      { name: "Meal Plans", icon: UtensilsCrossed, href: "/meals" },
      { name: "Meetings", icon: Calendar, href: "/meetings" },
      { name: "Messages", icon: MessageSquare, href: "/messages" },
      { name: "Settings", icon: Settings, href: "/settings" },
    ]
    : [
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { name: "Messages", icon: MessageSquare, href: "/messages" },
    ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {(user?.role === "admin" || user?.role === "client") && (
        <MessagesRealtime />
      )}
      <NavigationTracker />
      <VisualEditAgent />
      {/* Mobile header */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className={`h-8 w-8 object-contain shrink-0 ${logoShapeClass}`}
            />
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {settings[0]?.businessName || "Progrr"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-gray-300" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <span className="relative block">
              {sidebarOpen ? (
                <X className="w-6 h-6 dark:text-gray-300" />
              ) : (
                <Menu className="w-6 h-6 dark:text-gray-300" />
              )}
              {isAdmin && unreadMessagesCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                  {unreadMessagesCount}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50
            w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
            }
          `}
        >
          <div className="h-full flex flex-col">
            {/* Logo/Brand */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className={`h-8 w-8 object-contain shrink-0 ${logoShapeClass}`}
                  />
                )}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate min-w-0">
                  {settings[0]?.businessName || "Progrr"}
                </h1>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive
                        ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.name}</span>
                    {item.href === "/messages" && unreadMessagesCount > 0 && (
                      <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Theme Toggle & Logout */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <button
                onClick={toggleDarkMode}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
                <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen">{children}</main>
      </div>
    </div>
  );
}
