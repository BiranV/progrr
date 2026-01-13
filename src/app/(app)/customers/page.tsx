"use client";

import React from "react";

export default function CustomersPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Customers
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    View customer profiles and appointment history.
                </p>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground p-4">
                <div className="text-sm text-muted-foreground">
                    Customer list coming next.
                </div>
            </div>
        </div>
    );
}
