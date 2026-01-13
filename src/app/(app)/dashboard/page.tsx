"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
    const placeholderPublicUrl = "https://www.progrr.io/b/your-business";

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Overview of your business activity.
                </p>
            </div>

            {/* 1) Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
                <Card>
                    <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground">
                            Today&apos;s appointments
                        </div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            0
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground">
                            Upcoming appointments
                        </div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            0
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground">Total customers</div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            0
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground">Business status</div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            Open
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2) Public booking link */}
            <Card>
                <CardHeader>
                    <CardTitle>Public booking link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Input readOnly value={placeholderPublicUrl} />
                    <Button type="button">Share booking link</Button>
                </CardContent>
            </Card>

            {/* 3) Empty state note */}
            <div className="rounded-xl border bg-card text-card-foreground p-4">
                <div className="text-sm text-muted-foreground">
                    Your calendar and customers will appear here once you start receiving
                    bookings.
                </div>
            </div>
        </div>
    );
}
