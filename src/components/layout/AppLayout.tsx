"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getCookie, setCookie } from "@/lib/client-cookies";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import NavigationTracker from "@/lib/NavigationTracker";
import VisualEditAgent from "@/lib/VisualEditAgent";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  UtensilsCrossed,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoadingAuth: loading, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = getCookie("progrr_dark_mode");
      return saved === "true";
    }
    return false;
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => db.entities.AppSettings.list(),
    enabled: Boolean(user),
  });

  // Filter out blob URLs that might cause errors
  const rawLogoUrl = settings.length > 0 ? settings[0].logoUrl : null;
  const logoUrl =
    rawLogoUrl && rawLogoUrl.startsWith("blob:") ? null : rawLogoUrl;

  useEffect(() => {
    setCookie("progrr_dark_mode", darkMode ? "true" : "false", {
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleLogout = async () => {
    logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <img
          src="/logo.png"
          className="h-20 w-20 animate-zoom-in-out object-contain"
        />
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
      pathname.startsWith("/auth"); // Add other public paths if needed

    if (!user && !isPublic) {
      return null; // Render nothing while redirecting
    }

    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const isAdmin = user.role === "admin";

  const navItems = isAdmin
    ? [
        { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { name: "Clients", icon: Users, href: "/clients" },
        { name: "Workout Plans", icon: Dumbbell, href: "/plans" },
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
      <NavigationTracker />
      <VisualEditAgent />
      {/* Mobile header */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center overflow-hidden">
            <img
              src={logoUrl || "/logo.png"}
              alt="Logo"
              className="h-[180%] w-[180%] max-w-none object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {"Proggrr"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-gray-300" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6 dark:text-gray-300" />
            ) : (
              <Menu className="w-6 h-6 dark:text-gray-300" />
            )}
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
            transform transition-transform duration-200 ease-in-out
            ${
              sidebarOpen
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
                    className="h-8 object-contain"
                  />
                )}
                <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  Progrr
                </h1>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {user.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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
                      ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Theme Toggle & Logout */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
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
