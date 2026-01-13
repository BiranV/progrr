"use client";

import React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import AdminAuthStep from "./AdminAuthStep";
import { useAuth } from "@/context/AuthContext";
import { type AuthBannerState } from "./AuthBanner";

function isSafeNextPath(next: string): boolean {
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next === "/" || next.startsWith("/auth") || next.startsWith("/login")) {
    return false;
  }
  return true;
}

export default function AuthFlow({
  initialBanner,
  initialNext,
}: {
  initialBanner: AuthBannerState;
  initialNext: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const nextPath = React.useMemo(() => {
    const fromQuery = searchParams.get("next") || initialNext || "";
    return fromQuery && isSafeNextPath(fromQuery) ? fromQuery : "";
  }, [initialNext, searchParams]);

  React.useEffect(() => {
    if (isLoadingAuth) return;
    if (isAuthenticated) {
      router.replace(nextPath || "/dashboard");
    }
  }, [isAuthenticated, isLoadingAuth, nextPath, router]);

  if (isLoadingAuth) {
    return (
      <div className="flex-1 w-full h-full min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl"
        >
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden p-1.5">
            <Image
              src="/logo.png"
              alt="Loading..."
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex-1 w-full h-full min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl"
        >
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden p-1.5">
            <Image
              src="/logo.png"
              alt="Redirecting..."
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // AdminAuthStep handles its own banner logic via searchParams,
  // so we don't need to render AuthBanner here unless we want to force initialBanner.
  // However, AdminAuthStep reads params too.
  // We'll let AdminAuthStep handle it completely for the "Modern" feel.

  return (
    <div className="w-full flex-1 flex flex-col justify-center px-8 pb-12">
      <AdminAuthStep nextPath={nextPath} />
    </div>
  );
}
