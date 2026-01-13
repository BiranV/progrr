"use client";

import * as React from "react";

import AppProviders from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AppProviders>
            {children}
            <Toaster position="bottom-center" offset={80} />
        </AppProviders>
    );
}
