"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import ImageCropperModal, {
  type ImageCropperMode,
} from "@/components/ImageCropper";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/useI18n";

type BrandingState = {
  logoUrl?: string;
  logo?: { url: string; publicId?: string };
  banner?: { url: string; publicId?: string };
  gallery?: Array<
    string | { url: string; publicId?: string; width?: number; height?: number }
  >;
};

type GalleryItem = {
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

function normalizeGalleryFromApi(v: any): GalleryItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => {
      if (typeof x === "string") {
        const url = String(x ?? "").trim();
        if (!url) return null;
        return { url, publicId: "" } satisfies GalleryItem;
      }
      const url = String(x?.url ?? "").trim();
      if (!url) return null;
      return {
        url,
        publicId: String(x?.publicId ?? x?.public_id ?? "").trim(),
        width: typeof x?.width === "number" ? x.width : undefined,
        height: typeof x?.height === "number" ? x.height : undefined,
        bytes: typeof x?.bytes === "number" ? x.bytes : undefined,
        format: typeof x?.format === "string" ? x.format : undefined,
      } satisfies GalleryItem;
    })
    .filter(Boolean)
    .slice(0, 10) as GalleryItem[];
}

function normalizeGalleryFromState(v: any): GalleryItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => {
      if (typeof x === "string") {
        const url = String(x ?? "").trim();
        if (!url) return null;
        return { url, publicId: "" } satisfies GalleryItem;
      }
      const url = String(x?.url ?? "").trim();
      if (!url) return null;
      return {
        url,
        publicId: String(x?.publicId ?? x?.public_id ?? "").trim(),
        width: typeof x?.width === "number" ? x.width : undefined,
        height: typeof x?.height === "number" ? x.height : undefined,
        bytes: typeof x?.bytes === "number" ? x.bytes : undefined,
        format: typeof x?.format === "string" ? x.format : undefined,
      } satisfies GalleryItem;
    })
    .filter(Boolean)
    .slice(0, 10) as GalleryItem[];
}

function pickLogoUrl(branding: BrandingState | null | undefined) {
  const fromObj = String(branding?.logo?.url ?? "").trim();
  if (fromObj) return fromObj;
  const legacy = String(branding?.logoUrl ?? "").trim();
  return legacy;
}

export default function BrandingSettingsPage() {
  const { user, updateUser } = useAuth();
  const { t } = useI18n();

  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingBanner, setUploadingBanner] = React.useState(false);
  const [uploadingGallery, setUploadingGallery] = React.useState(false);
  const [removingGalleryIndex, setRemovingGalleryIndex] = React.useState<number | null>(null);
  const [galleryPendingPreviews, setGalleryPendingPreviews] = React.useState<
    string[]
  >([]);
  const [galleryError, setGalleryError] = React.useState<string | null>(null);
  const [replacingIndex, setReplacingIndex] = React.useState<number | null>(
    null
  );

  const [branding, setBranding] = React.useState<BrandingState>({});

  const logoInputId = React.useId();
  const bannerInputId = React.useId();
  const galleryAddInputId = React.useId();

  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropMode, setCropMode] = React.useState<ImageCropperMode>("logo");
  const [cropFile, setCropFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    const b = ((user as any)?.onboarding?.branding ?? {}) as BrandingState;
    setBranding({
      logoUrl: b.logoUrl,
      logo: b.logo,
      banner: b.banner,
      gallery: Array.isArray((b as any)?.gallery) ? (b as any).gallery : [],
    });
  }, [user]);

  React.useEffect(() => {
    return () => {
      galleryPendingPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [galleryPendingPreviews]);

  const syncUserBranding = React.useCallback(
    (next: Partial<BrandingState>) => {
      setBranding((prev) => ({ ...prev, ...next }));

      const current = (user as any)?.onboarding ?? {};
      const currentBranding = (current.branding ?? {}) as BrandingState;
      updateUser({
        onboarding: {
          ...current,
          branding: {
            ...currentBranding,
            ...next,
          },
        },
      });
    },
    [updateUser, user]
  );

  const patchOnboardingBranding = React.useCallback(
    async (next: Partial<BrandingState>) => {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const onboarding = json?.onboarding;
      if (onboarding && typeof onboarding === "object") {
        updateUser({
          onboarding: {
            ...((user as any)?.onboarding ?? {}),
            ...onboarding,
          },
        });
      }
      return json;
    },
    [updateUser, user]
  );

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/branding/logo", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const url = String(json?.logo?.url ?? json?.url ?? "").trim();
      const publicId = String(json?.logo?.publicId ?? "").trim();

      syncUserBranding({
        logo: url ? { url, publicId } : undefined,
        logoUrl: undefined,
      });
      toast.success(t("branding.toast.logoUpdated"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    setUploadingLogo(true);
    try {
      const res = await fetch("/api/branding/logo", {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      syncUserBranding({ logo: undefined, logoUrl: undefined });
      toast.success(t("branding.toast.logoRemoved"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadBanner = async (file: File) => {
    setUploadingBanner(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/branding/banner", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const url = String(json?.banner?.url ?? json?.url ?? "").trim();
      const publicId = String(json?.banner?.publicId ?? "").trim();

      syncUserBranding({ banner: url ? { url, publicId } : undefined });
      toast.success(t("branding.toast.bannerUpdated"));
    } finally {
      setUploadingBanner(false);
    }
  };

  const removeBanner = async () => {
    setUploadingBanner(true);
    try {
      const res = await fetch("/api/branding/banner", {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      syncUserBranding({ banner: undefined });
      toast.success(t("branding.toast.bannerRemoved"));
    } finally {
      setUploadingBanner(false);
    }
  };

  const logoUrl = pickLogoUrl(branding);
  const bannerUrl = String(branding?.banner?.url ?? "").trim();

  const uploadGalleryFiles = async (files: File[] | null) => {
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setGalleryError(null);
    let localPreviews: string[] = [];
    let clearPreviewsDelayMs = 0;
    try {
      const current = normalizeGalleryFromState(branding.gallery).length;
      const remaining = Math.max(0, 10 - current);
      if (remaining <= 0) throw new Error(t("onboarding.errors.galleryLimit", { max: 10 }));

      const selected = files.slice(0, remaining);

      const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
      const maxBytes = 5 * 1024 * 1024;
      const valid: File[] = [];
      const skipped: string[] = [];

      for (const f of selected) {
        const typeLabel = String(f.type || "").toLowerCase();
        if (typeLabel && !allowed.has(typeLabel)) {
          skipped.push(
            `${f.name || t("onboarding.errors.filePlaceholder")} (${t("onboarding.errors.unsupportedFormat")})`
          );
          continue;
        }
        if (f.size > maxBytes) {
          skipped.push(
            `${f.name || t("onboarding.errors.filePlaceholder")} (${t("onboarding.errors.tooLarge")})`
          );
          continue;
        }
        valid.push(f);
      }

      if (!valid.length) {
        throw new Error(t("onboarding.errors.invalidImageType"));
      }
      if (skipped.length) {
        toast.error(
          t("onboarding.errors.skippedFiles", {
            files: `${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}`,
          })
        );
      }

      localPreviews = valid.map((f) => URL.createObjectURL(f));
      setGalleryPendingPreviews((prev) => [...prev, ...localPreviews]);

      const fd = new FormData();
      valid.forEach((f) => fd.append("images", f));

      const res = await fetch("/api/branding/gallery", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const gallery = normalizeGalleryFromApi(json?.gallery);
      syncUserBranding({ gallery });
      toast.success(t("branding.toast.galleryUpdated"));

      clearPreviewsDelayMs = 0;
    } catch (e: any) {
      clearPreviewsDelayMs = 2500;
      const msg = e?.message || t("onboarding.errors.uploadImagesFailed");
      setGalleryError(msg);
      toast.error(msg);
      throw e;
    } finally {
      if (localPreviews.length) {
        const clear = () => {
          setGalleryPendingPreviews((prev) =>
            prev.filter((u) => !localPreviews.includes(u))
          );
          localPreviews.forEach((u) => URL.revokeObjectURL(u));
        };

        if (clearPreviewsDelayMs > 0) {
          window.setTimeout(clear, clearPreviewsDelayMs);
        } else {
          clear();
        }
      }
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = async (item: {
    url: string;
    publicId?: string;
    index?: number;
  }) => {
    if (typeof item.index === "number") {
      setRemovingGalleryIndex(item.index);
    }
    setGalleryError(null);
    try {
      const res = await fetch("/api/branding/gallery", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: String(item?.url ?? "").trim(),
          publicId: String(item?.publicId ?? "").trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const gallery = normalizeGalleryFromApi(json?.gallery);
      syncUserBranding({ gallery });
      toast.success(t("branding.toast.imageRemoved"));
    } catch (e: any) {
      const msg = e?.message || t("branding.errors.removeImageFailed");
      setGalleryError(msg);
      toast.error(msg);
      throw e;
    } finally {
      setRemovingGalleryIndex(null);
    }
  };

  const replaceGalleryImage = async (index: number, file: File) => {
    setReplacingIndex(index);
    setGalleryError(null);
    try {
      const before = normalizeGalleryFromState(branding.gallery);
      const target = before[index];
      if (!target) throw new Error(t("onboarding.errors.imageNotFound"));

      // Upload new (server appends)
      const fd = new FormData();
      fd.append("images", file);
      const upRes = await fetch("/api/branding/gallery", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const upJson = await upRes.json().catch(() => null);
      if (!upRes.ok)
        throw new Error(upJson?.error || `Request failed (${upRes.status})`);

      const added = normalizeGalleryFromApi(upJson?.added);
      const first = added?.[0];
      if (!first?.url) throw new Error(t("onboarding.errors.uploadFailed"));

      // Remove old
      await removeGalleryImage({ url: target.url, publicId: target.publicId });

      // Persist order to keep replaced image at same index
      const reordered = [...before];
      reordered[index] = first;

      const patchJson = await patchOnboardingBranding({ gallery: reordered });
      const normalizedFromServer = normalizeGalleryFromApi(
        patchJson?.onboarding?.branding?.gallery
      );
      syncUserBranding({
        gallery: normalizedFromServer.length ? normalizedFromServer : reordered,
      });

      toast.success(t("branding.toast.imageReplaced"));
    } catch (e: any) {
      const msg = e?.message || t("branding.errors.replaceImageFailed");
      setGalleryError(msg);
      toast.error(msg);
      throw e;
    } finally {
      setReplacingIndex(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("branding.title")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("branding.subtitle")}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 space-y-4">
        <div className="space-y-1">
          <div className="font-semibold text-gray-900 dark:text-white">
            {t("branding.logoTitle")}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t("branding.logoHelp")}
          </div>
        </div>

        <input
          id={logoInputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploadingLogo}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setCropMode("logo");
            setCropFile(file);
            setCropOpen(true);
          }}
        />

        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-200 dark:ring-gray-700 shadow-sm flex items-center justify-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={t("branding.logoAlt")}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-300">
                {t("branding.noLogo")}
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-wrap gap-2">
            <Button
              asChild
              type="button"
              variant="outline"
              disabled={uploadingLogo}
              className="rounded-xl"
            >
              <label htmlFor={logoInputId} className="cursor-pointer">
                <span className="inline-flex items-center gap-2">
                  {uploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  <span>
                    {logoUrl ? t("branding.replaceLogo") : t("branding.uploadLogo")}
                  </span>
                </span>
              </label>
            </Button>

            {logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                disabled={uploadingLogo}
                className="rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() =>
                  removeLogo().catch((err: any) =>
                    toast.error(err?.message || t("branding.errors.removeLogoFailed"))
                  )
                }
              >
                {t("branding.remove")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 space-y-4">
        <div className="space-y-1">
          <div className="font-semibold text-gray-900 dark:text-white">
            {t("branding.bannerTitle")}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t("branding.bannerHelp")}
          </div>
        </div>

        <input
          id={bannerInputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploadingBanner}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setCropMode("banner");
            setCropFile(file);
            setCropOpen(true);
          }}
        />

        <div className="space-y-3">
          <div className="relative w-full h-[140px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-neutral-950 via-zinc-900 to-zinc-800">
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                alt={t("branding.bannerAlt")}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-transparent" />
            {!bannerUrl ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-xs font-medium text-white/80">
                  {t("branding.noBanner")}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              type="button"
              variant="outline"
              disabled={uploadingBanner}
              className="rounded-xl"
            >
              <label htmlFor={bannerInputId} className="cursor-pointer">
                <span className="inline-flex items-center gap-2">
                  {uploadingBanner ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  <span>
                    {bannerUrl ? t("branding.replaceBanner") : t("branding.uploadBanner")}
                  </span>
                </span>
              </label>
            </Button>

            {bannerUrl ? (
              <Button
                type="button"
                variant="ghost"
                disabled={uploadingBanner}
                className="rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() =>
                  removeBanner().catch((err: any) =>
                    toast.error(err?.message || t("branding.errors.removeBannerFailed"))
                  )
                }
              >
                {t("branding.remove")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white">
              {t("branding.galleryTitle")}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {t("branding.galleryHelp", { max: 10 })}
            </div>
          </div>
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0">
            {normalizeGalleryFromState(branding.gallery).length +
              galleryPendingPreviews.length}
            /10
          </div>
        </div>

        <input
          id={galleryAddInputId}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploadingGallery}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            uploadGalleryFiles(picked).catch(() => null);
          }}
        />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {galleryPendingPreviews.map((url, idx) => (
            <div
              key={`pending-${url}-${idx}`}
              className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={t("branding.uploading")}
                className="h-full w-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/50 text-white p-2 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            </div>
          ))}

          {normalizeGalleryFromState(branding.gallery).map((item, idx) => {
            const url = String(item?.url ?? "").trim();
            if (!url) return null;
            const publicId = String(item?.publicId ?? "").trim();
            return (
              <div
                key={`${url}-${idx}`}
                className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <input
                  id={`${galleryAddInputId}-replace-${idx}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingGallery || replacingIndex === idx}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    replaceGalleryImage(idx, file).catch(() => null);
                  }}
                />

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={t("branding.galleryImageAlt", { index: idx + 1 })}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />

                <div className="absolute inset-x-0 top-0 p-1.5 flex justify-end gap-1">
                  <label
                    htmlFor={`${galleryAddInputId}-replace-${idx}`}
                    className={
                      "rounded-lg bg-black/45 text-white text-[11px] px-2 py-1 backdrop-blur-sm hover:bg-black/55 transition " +
                      (uploadingGallery || replacingIndex === idx
                        ? "opacity-60 pointer-events-none"
                        : "cursor-pointer")
                    }
                  >
                    {replacingIndex === idx ? "…" : t("branding.replaceImage")}
                  </label>

                  <button
                    type="button"
                    disabled={uploadingGallery || removingGalleryIndex === idx}
                    onClick={() =>
                      removeGalleryImage({ url, publicId, index: idx }).catch(() => null)
                    }
                    className="rounded-lg bg-black/45 text-white p-1.5 backdrop-blur-sm hover:bg-black/55 transition disabled:opacity-60"
                    aria-label={t("branding.removeImage")}
                  >
                    {removingGalleryIndex === idx ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {(() => {
            const count =
              normalizeGalleryFromState(branding.gallery).length +
              galleryPendingPreviews.length;
            if (count >= 10) return null;
            return (
              <label
                htmlFor={galleryAddInputId}
                className={
                  "aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-950/10 flex items-center justify-center text-center p-2 hover:border-gray-300 dark:hover:border-gray-600 transition " +
                  (uploadingGallery
                    ? "opacity-60 pointer-events-none"
                    : "cursor-pointer")
                }
              >
                <div className="flex flex-col items-center gap-1">
                  {uploadingGallery ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-300" />
                  ) : null}
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {t("branding.addImages")}
                  </div>
                </div>
              </label>
            );
          })()}
        </div>

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {t("branding.galleryFooter")}
        </div>

        {galleryError ? (
          <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {galleryError}
          </div>
        ) : null}
      </div>

      <ImageCropperModal
        open={cropOpen}
        mode={cropMode}
        file={cropFile}
        onCancel={() => {
          setCropOpen(false);
          setCropFile(null);
        }}
        onConfirm={async (cropped) => {
          try {
            if (cropMode === "logo") {
              await uploadLogo(cropped);
            } else {
              await uploadBanner(cropped);
            }
            setCropOpen(false);
            setCropFile(null);
          } catch (err: any) {
            toast.error(err?.message || t("branding.errors.uploadImageFailed"));
            throw err;
          }
        }}
      />
    </div>
  );
}
