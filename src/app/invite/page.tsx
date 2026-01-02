"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Invite links are no longer used
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-gray-600">
            Client access is now via phone verification codes. Please return to
            the login page.
          </p>
          <Button
            className="w-full"
            onClick={() => (window.location.href = "/")}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
