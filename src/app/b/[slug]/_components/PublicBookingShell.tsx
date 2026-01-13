"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicBusiness } from "@/lib/public-booking";

export default function PublicBookingShell({
  business,
  title,
  subtitle,
  onBack,
  children,
  showGallery = true,
}: {
  business?: PublicBusiness | null;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showGallery?: boolean;
  children: React.ReactNode;
}) {
  const logoUrl = String(business?.branding?.logoUrl ?? "").trim();
  const gallery = Array.isArray(business?.branding?.gallery)
    ? (business?.branding?.gallery || []).filter(Boolean).slice(0, 10)
    : [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      <div className="relative w-full z-0 h-[140px] bg-purple-600 shrink-0">
        <div className="absolute inset-0 opacity-20 bg-[url('/grid.svg')] mix-blend-overlay" />
      </div>

      <div className="flex-1 -mt-16 bg-gray-50 dark:bg-zinc-900 rounded-t-[40px] relative z-10 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        <div className="w-full max-w-md px-6">
          <div className="-mt-10 flex items-center justify-between">
            <div className="w-10">
              {onBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="rounded-full text-white hover:bg-white/10"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : null}
            </div>

            <div className="p-1.5 rounded-full bg-transparent">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-purple-50 shadow-xl">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Business logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src="/logo.png"
                    alt="Progrr"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                )}
              </div>
            </div>

            <div className="w-10" />
          </div>

          <div className="text-center space-y-1 mt-4 mb-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {business?.business?.name || title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-300 font-medium">
              {subtitle || title}
            </p>
          </div>

          {showGallery && gallery.length > 0 ? (
            <div className="mb-5">
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                {gallery.map((src, idx) => (
                  <div
                    key={`${src}-${idx}`}
                    className={cn(
                      "snap-start shrink-0 rounded-2xl overflow-hidden",
                      "shadow-sm border border-gray-200/70 dark:border-gray-800",
                      "bg-gray-100 dark:bg-gray-800"
                    )}
                    style={{ width: 140, height: 96 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Gallery image ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Photos from {business?.business?.name || "this business"}
              </div>
            </div>
          ) : null}

          <div className="pb-28">{children}</div>
        </div>
      </div>
    </div>
  );
}
