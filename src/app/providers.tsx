"use client";

import * as React from "react";

import AppProviders from "@/components/providers";

export function Providers({
    children,
    initialLanguage,
}: {
    children: React.ReactNode;
    initialLanguage?: "en" | "he";
}) {
    return <AppProviders>{children}</AppProviders>;
}
