import { createPortalSession } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function ReactivatePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl text-red-600">
            Subscription Inactive
          </CardTitle>
          <CardDescription>
            Your subscription is currently past due or canceled. Please update
            your payment method to continue accessing the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPortalSession}>
            <Button className="w-full" type="submit">
              Manage Subscription
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
