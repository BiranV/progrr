import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock } from "lucide-react";

export default function AccessPendingLimitPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="max-w-md w-full shadow-lg">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-2">
                        <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <CardTitle className="text-xl font-bold">Access Pending</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                    <p className="text-gray-600 dark:text-gray-300">
                        Your email is verified, but your coach has reached their active client
                        limit.
                        <br />
                        Please contact your coach to restore access.
                    </p>
                    <div className="flex justify-center">
                        <Link href="/auth?mode=client">
                            <Button variant="outline">Back to Login</Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
