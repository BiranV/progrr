import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Ban } from "lucide-react";

export default function AccessBlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="max-w-md w-full shadow-lg border-red-200 dark:border-red-900/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-2">
            <Ban className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl font-bold text-red-600 dark:text-red-400">
            Account Blocked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Your account has been blocked.
            <br />
            If you believe this is a mistake, contact support.
          </p>
          <div className="text-sm text-gray-400">Security enforcement</div>
        </CardContent>
      </Card>
    </div>
  );
}
