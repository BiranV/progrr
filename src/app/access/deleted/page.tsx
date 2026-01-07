import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

export default function AccessDeletedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
            <Trash2 className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
          <CardTitle className="text-xl font-bold">Account Deleted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            This account was deleted and cannot be accessed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
