"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function AuthGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/onboarding");

  return (
    <div
      className={`min-h-screen w-full relative overflow-hidden flex flex-col ${
        isOnboarding
          ? "bg-background"
          : "bg-gradient-to-br from-purple-600 to-indigo-700"
      }`}
    >
      <main className="flex-1 w-full h-full flex flex-col">{children}</main>
    </div>
  );
}
