"use client";

import React from "react";

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

            <div className="rounded-xl border bg-card text-card-foreground p-4">
                <div className="text-sm text-muted-foreground">
                    Calendar view coming next.
                </div>
            </div>
        </div>
    );
}
