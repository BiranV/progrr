"use client";

import React from "react";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function CustomersPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Customers
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manage your customer list and history.
                </p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="min-h-[52vh] flex flex-col items-center justify-center text-center px-4">
                        <Users className="h-7 w-7 text-muted-foreground" />
                        <div className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                            No customers yet
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            Customers will appear here once bookings start.
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground">
                You’ll be able to view customer details and booking history here.
            </div>
        </div>
    );
}
