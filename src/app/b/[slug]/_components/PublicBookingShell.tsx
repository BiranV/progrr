"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Instagram,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicBusiness } from "@/lib/public-booking";

export default function PublicBookingShell({
  business,
  title,
  subtitle,
  subtitleRight,
  onBack,
  children,
  showGallery = true,
}: {
  business?: PublicBusiness | null;
  title: string;
  subtitle?: string;
  subtitleRight?: React.ReactNode;
  onBack?: () => void;
  showGallery?: boolean;
  children: React.ReactNode;
}) {
  const [isRtl, setIsRtl] = React.useState(false);

  React.useEffect(() => {
    const el = document?.documentElement;
    if (!el) return;

    const dirAttr = String(el.getAttribute("dir") ?? "").toLowerCase();
    const computedDir =
      typeof window !== "undefined" ? getComputedStyle(el).direction : "ltr";
    setIsRtl(dirAttr === "rtl" || computedDir === "rtl");
  }, []);

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

  const businessName = String(business?.business?.name ?? title).trim();
  const businessPhone = String(business?.business?.phone ?? "").trim();
  const businessAddress = String(business?.business?.address ?? "").trim();
  const instagramRaw = String(
    (business as any)?.business?.instagram ?? ""
  ).trim();
  const whatsappRaw = String(
    (business as any)?.business?.whatsapp ?? ""
  ).trim();

  const digitsOnly = (value: string) => value.replace(/\D/g, "");

  const wazeHref = businessAddress
    ? `https://waze.com/ul?q=${encodeURIComponent(
        businessAddress
      )}&navigate=yes`
    : "";

  const telHref = businessPhone ? `tel:${businessPhone}` : "";

  const instagramHref = (() => {
    if (!instagramRaw) return "";
    if (/^https?:\/\//i.test(instagramRaw)) return instagramRaw;
    const handle = instagramRaw.replace(/^@/, "").trim();
    if (!handle) return "";
    return `https://instagram.com/${encodeURIComponent(handle)}`;
  })();

  const whatsappDigits = digitsOnly(whatsappRaw || businessPhone);
  const whatsappHref =
    whatsappDigits.length >= 9 ? `https://wa.me/${whatsappDigits}` : "";

  const quickActions = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      aria: "Message on WhatsApp",
      href: whatsappHref,
      Icon: MessageCircle,
    },
    {
      key: "call",
      label: "Call",
      aria: "Call the business",
      href: telHref,
      Icon: Phone,
    },
    {
      key: "instagram",
      label: "Instagram",
      aria: "Open Instagram",
      href: instagramHref,
      Icon: Instagram,
    },
    {
      key: "waze",
      label: "Waze",
      aria: "Open Waze navigation",
      href: wazeHref,
      Icon: Navigation,
    },
  ].filter((a) => !!a.href);

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
        <div className="w-full max-w-md px-6 relative">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBack}
              className={cn(
                "absolute top-5 rounded-xl",
                "text-gray-900 hover:bg-gray-100",
                "dark:text-white dark:hover:bg-white/10",
                isRtl ? "right-6" : "left-6"
              )}
              aria-label="Back"
            >
              <ArrowLeft className={"h-5 w-5" + (isRtl ? " rotate-180" : "")} />
            </Button>
          ) : null}

          <div className="-mt-10 flex items-center justify-between">
            <div className="w-10">
              {/* Back button is rendered in the top header for consistent placement */}
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

          <div className="space-y-1 mt-4 mb-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight text-center w-full">
              {businessName}
            </h1>

            {quickActions.length ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {quickActions.map(({ key, href, aria, label, Icon }) => (
                  <a
                    key={key}
                    href={href}
                    target={key === "call" ? undefined : "_blank"}
                    rel={key === "call" ? undefined : "noopener noreferrer"}
                    aria-label={aria}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-2",
                      "h-11 px-3 rounded-xl",
                      "border border-gray-200/70 dark:border-gray-800",
                      "bg-white/70 dark:bg-gray-950/20",
                      "text-gray-900 dark:text-white",
                      "shadow-sm",
                      "transition",
                      "hover:bg-white hover:shadow-md",
                      "dark:hover:bg-gray-900/30"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold">{label}</span>
                  </a>
                ))}
              </div>
            ) : null}
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
                        "cursor-pointer",
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
                        "cursor-pointer",
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
            </div>
          ) : null}

          {subtitle || subtitleRight ? (
            <div
              className={cn(
                "flex items-center gap-3",
                showGallery && gallery.length > 0 ? "mt-5" : "mt-3",
                "mb-3",
                "justify-between"
              )}
            >
              <div className="min-w-0">
                {subtitle ? (
                  <div className="text-base font-semibold text-gray-900 dark:text-white text-left">
                    {subtitle}
                  </div>
                ) : null}
              </div>
              {subtitleRight ? (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate whitespace-nowrap text-right">
                  {subtitleRight}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="pb-28">{children}</div>
        </div>
      </div>
    </div>
  );
}
