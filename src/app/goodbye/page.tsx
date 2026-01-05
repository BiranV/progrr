import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function GoodbyePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Account deleted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your account has been permanently deleted. You no longer have access
            to clients, programs, plans, or history.
          </p>
          <Button asChild>
            <Link href="/">Return to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
