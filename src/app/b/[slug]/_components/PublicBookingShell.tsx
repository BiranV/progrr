"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Instagram,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import SidePanel from "@/components/ui/side-panel";
import { useI18n } from "@/i18n/useI18n";
import { cn } from "@/lib/utils";
import type { PublicBusiness } from "@/lib/public-booking";

export default function PublicBookingShell({
  business,
  title,
  subtitle,
  subtitleRight,
  headerRight,
  onBack,
  children,
  showGallery = true,
}: {
  business?: PublicBusiness | null;
  title: string;
  subtitle?: string;
  subtitleRight?: React.ReactNode;
  headerRight?: React.ReactNode;
  onBack?: () => void;
  showGallery?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);

  const logoUrl = String(business?.branding?.logoUrl ?? "").trim();
  const bannerUrl = String(
    business?.branding?.bannerUrl ?? business?.branding?.banner?.url ?? "",
  ).trim();
  const gallery = Array.isArray(business?.branding?.gallery)
    ? (business?.branding?.gallery || []).filter(Boolean).slice(0, 10)
    : [];

  const galleryMaxVisible = 6;
  const galleryPaged = gallery.length > galleryMaxVisible;

  const galleryPages = React.useMemo(() => {
    if (!galleryPaged) return [gallery];
    const pages: string[][] = [];
    for (let i = 0; i < gallery.length; i += galleryMaxVisible) {
      pages.push(gallery.slice(i, i + galleryMaxVisible));
    }
    return pages;
  }, [gallery, galleryPaged]);

  const galleryScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [galleryPage, setGalleryPage] = React.useState(0);

  React.useEffect(() => {
    setGalleryPage(0);
    if (galleryPaged && galleryScrollerRef.current) {
      galleryScrollerRef.current.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [galleryPaged, galleryPages.length]);

  const scrollGalleryToPage = React.useCallback(
    (nextPage: number) => {
      const el = galleryScrollerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(nextPage, galleryPages.length - 1));
      const pageWidth = el.clientWidth || 1;
      el.scrollTo({ left: clamped * pageWidth, behavior: "smooth" });
    },
    [galleryPages.length],
  );

  React.useEffect(() => {
    const el = galleryScrollerRef.current;
    if (!galleryPaged || !el) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const pageWidth = el.clientWidth || 1;
        const next = Math.round(el.scrollLeft / pageWidth);
        setGalleryPage((p) => (p === next ? p : next));
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [galleryPaged]);

  const businessName = String(business?.business?.name ?? title).trim();
  const businessPhone = String(business?.business?.phone ?? "").trim();
  const businessAddress = String(business?.business?.address ?? "").trim();
  const businessDescription = String(
    (business as any)?.business?.description ?? "",
  ).trim();
  const instagramRaw = String(
    (business as any)?.business?.instagram ?? "",
  ).trim();
  const whatsappRaw = String(
    (business as any)?.business?.whatsapp ?? "",
  ).trim();

  const digitsOnly = (value: string) => value.replace(/\D/g, "");

  const wazeHref = businessAddress
    ? `https://waze.com/ul?q=${encodeURIComponent(
      businessAddress,
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
      label: t("publicBooking.quickActions.whatsapp"),
      aria: t("publicBooking.quickActions.whatsappAria"),
      href: whatsappHref,
      Icon: MessageCircle,
    },
    {
      key: "call",
      label: t("publicBooking.quickActions.call"),
      aria: t("publicBooking.quickActions.callAria"),
      href: telHref,
      Icon: Phone,
    },
    {
      key: "instagram",
      label: t("publicBooking.quickActions.instagram"),
      aria: t("publicBooking.quickActions.instagramAria"),
      href: instagramHref,
      Icon: Instagram,
    },
    {
      key: "waze",
      label: t("publicBooking.quickActions.waze"),
      aria: t("publicBooking.quickActions.wazeAria"),
      href: wazeHref,
      Icon: Navigation,
    },
  ].filter((a) => !!a.href);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      <SidePanel
        open={Boolean(previewSrc)}
        onOpenChange={(open) => {
          if (!open) setPreviewSrc(null);
        }}
        title={t("publicBooking.imagePreviewTitle")}
        description={undefined}
      >
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={t("publicBooking.galleryImageAlt", { index: 1 })}
            className="w-full max-h-[80vh] object-contain bg-black rounded-xl"
            draggable={false}
          />
        ) : null}
      </SidePanel>

      <div className="relative w-full z-0 h-[140px] bg-gradient-to-br from-neutral-950 via-zinc-900 to-zinc-800 shrink-0 overflow-hidden">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt={t("publicBooking.businessBannerAlt")}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-transparent" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" />
        <div className="absolute top-4 inset-x-0 z-20 flex justify-center">
          <LanguageSwitcher variant="dark" />
        </div>
      </div>

      <div className="flex-1 -mt-10 bg-gray-50 dark:bg-zinc-900 rounded-t-[40px] relative z-10 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        <div className="flex-1 px-6 pt-6 pb-24 w-full max-w-md mx-auto relative">
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
                "start-6",
              )}
              aria-label={t("common.back")}
            >
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
          ) : null}

          {headerRight ? (
            <div className="absolute top-5 end-6 flex items-center justify-end">
              {headerRight}
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <div className="w-10">
              {/* Back button is rendered in the top header for consistent placement */}
            </div>

            {/*
            <div className="p-1.5 rounded-full bg-transparent">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-xl">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={t("publicBooking.businessLogoAlt")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src="/logo-new.png"
                    alt={t("common.appName")}
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                )}
              </div>
            </div>
            */}

            <div className="w-10" />
          </div>

          <div className="space-y-1 mt-6 mb-6">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight text-center w-full">
              {businessName}
            </h1>

            {businessDescription ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                {businessDescription}
              </p>
            ) : null}

            {quickActions.length ? (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {quickActions.map(({ key, href, aria, label, Icon }) => (
                  <a
                    key={key}
                    href={href}
                    target={key === "call" ? undefined : "_blank"}
                    rel={key === "call" ? undefined : "noopener noreferrer"}
                    aria-label={aria}
                    className={cn(
                      "group relative inline-flex items-center justify-center",
                      "h-11 w-11 rounded-xl aspect-square",
                      "border border-gray-200/70 dark:border-gray-800",
                      "bg-white/60 dark:bg-gray-950/20",
                      "text-gray-700 dark:text-gray-200",
                      "shadow-sm",
                      "transition",
                      "hover:bg-gray-100/80 hover:shadow-md",
                      "active:scale-[0.98]",
                      "dark:hover:bg-gray-900/30",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/25 dark:focus-visible:ring-white/30",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span
                      className={cn(
                        "hidden md:block",
                        "pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2",
                        "rounded-md bg-gray-900/90 text-white",
                        "px-2 py-1 text-[11px] font-medium",
                        "opacity-0 transition-opacity",
                        "group-hover:opacity-100",
                        "shadow-sm",
                      )}
                    >
                      {label}
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {showGallery && gallery.length > 0 ? (
            <div className="mb-5">
              {!galleryPaged ? (
                <div
                  className={cn(
                    "grid grid-cols-3 gap-2",
                    "auto-rows-[84px] sm:auto-rows-[92px]",
                  )}
                >
                  {gallery.map((src, idx) => {
                    const isHero = idx === 0 && gallery.length >= 3;
                    return (
                      <button
                        type="button"
                        key={`${src}-${idx}`}
                        aria-label={
                          t("publicBooking.openGalleryImage", {
                            index: idx + 1,
                          })
                        }
                        onClick={() => setPreviewSrc(src)}
                        className={cn(
                          "group relative overflow-hidden",
                          "rounded-2xl",
                          "border border-gray-200/70 dark:border-gray-800",
                          "bg-gray-100 dark:bg-gray-800",
                          "shadow-sm",
                          "transition",
                          "hover:shadow-md",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 dark:focus-visible:ring-white/30",
                          "cursor-zoom-in",
                          isHero
                            ? "col-span-2 row-span-2"
                            : "col-span-1 row-span-1",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={
                            t("publicBooking.galleryImageAlt", {
                              index: idx + 1,
                            })
                          }
                          className={cn(
                            "h-full w-full object-cover",
                            "transition duration-300",
                            "group-hover:scale-[1.03]",
                          )}
                          draggable={false}
                        />
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0",
                            "bg-gradient-to-t from-black/25 via-black/0 to-black/0",
                            "opacity-0 group-hover:opacity-100",
                            "transition-opacity",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="relative">
                  <div
                    ref={galleryScrollerRef}
                    dir="ltr"
                    className={cn(
                      "flex overflow-x-auto scroll-smooth",
                      "snap-x snap-mandatory",
                      "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                    )}
                  >
                    {galleryPages.map((page, pageIdx) => (
                      <div key={pageIdx} className="shrink-0 w-full snap-start">
                        <div
                          className={cn(
                            "grid grid-cols-3 gap-2",
                            "auto-rows-[84px] sm:auto-rows-[92px]",
                          )}
                        >
                          {page.map((src, idx) => (
                            <button
                              type="button"
                              key={`${src}-${pageIdx}-${idx}`}
                              aria-label={
                                t("publicBooking.openGalleryImage", {
                                  index: pageIdx * galleryMaxVisible + idx + 1,
                                })
                              }
                              onClick={() => setPreviewSrc(src)}
                              className={cn(
                                "group relative overflow-hidden",
                                "rounded-2xl",
                                "border border-gray-200/70 dark:border-gray-800",
                                "bg-gray-100 dark:bg-gray-800",
                                "shadow-sm",
                                "transition",
                                "hover:shadow-md",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 dark:focus-visible:ring-white/30",
                                "cursor-zoom-in",
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt={
                                  t("publicBooking.galleryImageAlt", {
                                    index: pageIdx * galleryMaxVisible + idx + 1,
                                  })
                                }
                                className={cn(
                                  "h-full w-full object-cover",
                                  "transition duration-300",
                                  "group-hover:scale-[1.03]",
                                )}
                                draggable={false}
                              />
                              <div
                                className={cn(
                                  "pointer-events-none absolute inset-0",
                                  "bg-gradient-to-t from-black/25 via-black/0 to-black/0",
                                  "opacity-0 group-hover:opacity-100",
                                  "transition-opacity",
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pointer-events-none absolute inset-y-0 inset-x-0 flex items-center justify-between">
                    <div className="pointer-events-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => scrollGalleryToPage(galleryPage - 1)}
                        disabled={galleryPage <= 0}
                        className={cn(
                          "rounded-2xl",
                          "h-10 w-10",
                          "bg-white/70 dark:bg-black/40",
                          "backdrop-blur",
                          "border border-gray-200/70 dark:border-gray-800",
                          "shadow-sm",
                          "ms-1",
                        )}
                        aria-label={t("publicBooking.galleryPrev")}
                      >
                        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                      </Button>
                    </div>

                    <div className="pointer-events-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => scrollGalleryToPage(galleryPage + 1)}
                        disabled={galleryPage >= galleryPages.length - 1}
                        className={cn(
                          "rounded-2xl",
                          "h-10 w-10",
                          "bg-white/70 dark:bg-black/40",
                          "backdrop-blur",
                          "border border-gray-200/70 dark:border-gray-800",
                          "shadow-sm",
                          "me-1",
                        )}
                        aria-label={t("publicBooking.galleryNext")}
                      >
                        <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    {galleryPages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => scrollGalleryToPage(i)}
                        aria-label={
                          t("publicBooking.galleryGoTo", { index: i + 1 })
                        }
                        className={cn(
                          "h-1.5 rounded-full transition",
                          i === galleryPage
                            ? "w-6 bg-gray-900/60 dark:bg-white/60"
                            : "w-2 bg-gray-900/20 dark:bg-white/20",
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {subtitle || subtitleRight ? (
            <div
              className={cn(
                "flex items-center gap-3",
                headerRight
                  ? "mt-0"
                  : showGallery && gallery.length > 0
                    ? "mt-5"
                    : "mt-3",
                "mb-3",
                "justify-between",
              )}
            >
              <div className="min-w-0">
                {subtitle ? (
                  <div className="text-base font-semibold text-gray-900 dark:text-white text-start">
                    {subtitle}
                  </div>
                ) : null}
              </div>
              {subtitleRight ? (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate whitespace-nowrap text-end">
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
