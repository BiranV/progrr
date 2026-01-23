"use client";

import React from "react";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function AuthGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/onboarding");

  return (
    <div
      className={`min-h-screen w-full relative overflow-hidden flex flex-col ${isOnboarding
        ? "bg-background"
        : "bg-gradient-to-br from-neutral-950 via-zinc-900 to-zinc-800"
        }`}
    >
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher variant={isOnboarding ? "light" : "dark"} />
      </div>
      <main className="flex-1 w-full h-full flex flex-col">{children}</main>
    </div>
  );
}
