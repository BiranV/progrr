"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function CalendarPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Calendar
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manage your appointments.
                </p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="min-h-[52vh] flex flex-col items-center justify-center text-center px-4">
                        <div className="text-sm text-muted-foreground">
                            Calendar view coming next.
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            You will be able to view and manage appointments here.
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground">
                Appointments will appear here once customers start booking.
            </div>
        </div>
    );
}
