"use client";

import * as React from "react";

import AppProviders from "@/components/providers";

export function Providers({ children }: { children: React.ReactNode }) {
    return <AppProviders>{children}</AppProviders>;
}
