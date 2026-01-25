"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import SettingsBackHeader from "@/components/settings/SettingsBackHeader";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const showBackHeader = pathname !== "/settings";

    return (
        <div className="pb-5">
            {showBackHeader ? (
                <div className="mb-4">
                    <SettingsBackHeader />
                </div>
            ) : null}
            {children}
        </div>
    );
}
