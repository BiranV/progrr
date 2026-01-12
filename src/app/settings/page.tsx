"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { logout } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Minimal settings placeholder.
        </p>
      </div>

      <div>
        <Button variant="outline" onClick={() => logout()}>
          Logout
        </Button>
      </div>
    </div>
  );
}
