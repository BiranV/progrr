"use client";

import { LogOut, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 py-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{user?.full_name || "User"}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Preferences
        </h2>

        <Button
          variant="outline"
          className="w-full justify-between h-14 text-base rounded-xl"
          onClick={toggleDarkMode}
        >
          <span className="flex items-center gap-3">
            {darkMode ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            {darkMode ? "Dark Mode" : "Light Mode"}
          </span>
        </Button>
      </div>

      <div className="space-y-4 pt-4">
        <Button
          variant="destructive"
          className="w-full justify-start h-14 text-base rounded-xl px-4"
          onClick={() => logout()}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
}
