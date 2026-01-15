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
  const bannerUrl = String(
    business?.branding?.bannerUrl ?? business?.branding?.banner?.url ?? ""
  ).trim();
  const gallery = Array.isArray(business?.branding?.gallery)
    ? (business?.branding?.gallery || []).filter(Boolean).slice(0, 10)
    : [];

  const galleryRef = React.useRef<HTMLDivElement | null>(null);
  const scrollGallery = (dir: -1 | 1) => {
    const el = galleryRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      <div className="relative w-full z-0 h-[140px] bg-gradient-to-br from-neutral-950 via-zinc-900 to-zinc-800 shrink-0 overflow-hidden">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt="Business banner"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-transparent" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" />
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
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-xl">
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
              <div className="relative">
                <div
                  ref={galleryRef}
                  className={cn(
                    "flex gap-3 overflow-x-auto pb-2 -mx-2 px-2",
                    "snap-x snap-mandatory scroll-smooth",
                    "no-scrollbar"
                  )}
                >
                  {gallery.map((src, idx) => (
                    <div
                      key={`${src}-${idx}`}
                      className={cn(
                        "snap-start shrink-0 rounded-2xl overflow-hidden",
                        "shadow-sm border border-gray-200/70 dark:border-gray-800",
                        "bg-gray-100 dark:bg-gray-800"
                      )}
                      style={{ width: 190, height: 115 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Gallery image ${idx + 1}`}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>

                {gallery.length > 1 ? (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-gray-50 dark:from-black to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-gray-50 dark:from-black to-transparent" />
                    <button
                      type="button"
                      aria-label="Scroll gallery left"
                      onClick={() => scrollGallery(-1)}
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2",
                        "h-9 w-9 rounded-full",
                        "bg-white/80 dark:bg-zinc-900/70",
                        "border border-gray-200/70 dark:border-gray-800",
                        "shadow-sm backdrop-blur",
                        "grid place-items-center",
                        "hover:bg-white dark:hover:bg-zinc-900",
                        "transition"
                      )}
                    >
                      <span className="text-lg leading-none text-gray-700 dark:text-gray-200">
                        ‹
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Scroll gallery right"
                      onClick={() => scrollGallery(1)}
                      className={cn(
                        "absolute right-0 top-1/2 -translate-y-1/2",
                        "h-9 w-9 rounded-full",
                        "bg-white/80 dark:bg-zinc-900/70",
                        "border border-gray-200/70 dark:border-gray-800",
                        "shadow-sm backdrop-blur",
                        "grid place-items-center",
                        "hover:bg-white dark:hover:bg-zinc-900",
                        "transition"
                      )}
                    >
                      <span className="text-lg leading-none text-gray-700 dark:text-gray-200">
                        ›
                      </span>
                    </button>
                  </>
                ) : null}
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
