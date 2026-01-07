"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AccessInactivePage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
            <Moon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
          <CardTitle className="text-xl font-bold">Account Inactive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Your account is currently inactive.
            <br />
            To continue, please contact your coach or reactivate your plan.
          </p>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => logout(true)}>
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
