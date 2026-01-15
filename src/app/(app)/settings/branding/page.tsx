"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import ImageCropperModal, {
  type ImageCropperMode,
} from "@/components/ImageCropper";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

type BrandingState = {
  logoUrl?: string;
  logo?: { url: string; publicId?: string };
  banner?: { url: string; publicId?: string };
};

function pickLogoUrl(branding: BrandingState | null | undefined) {
  const fromObj = String(branding?.logo?.url ?? "").trim();
  if (fromObj) return fromObj;
  const legacy = String(branding?.logoUrl ?? "").trim();
  return legacy;
}

export default function BrandingSettingsPage() {
  const { user, updateUser } = useAuth();

  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingBanner, setUploadingBanner] = React.useState(false);

  const [branding, setBranding] = React.useState<BrandingState>({});

  const logoInputId = React.useId();
  const bannerInputId = React.useId();

  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropMode, setCropMode] = React.useState<ImageCropperMode>("logo");
  const [cropFile, setCropFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    const b = ((user as any)?.onboarding?.branding ?? {}) as BrandingState;
    setBranding({
      logoUrl: b.logoUrl,
      logo: b.logo,
      banner: b.banner,
    });
  }, [user]);

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
      toast.success("Logo updated");
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
      toast.success("Logo removed");
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
      toast.success("Banner updated");
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
      toast.success("Banner removed");
    } finally {
      setUploadingBanner(false);
    }
  };

  const logoUrl = pickLogoUrl(branding);
  const bannerUrl = String(branding?.banner?.url ?? "").trim();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Branding
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Upload a logo and banner. Cropping is required before saving.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 space-y-4">
        <div className="space-y-1">
          <div className="font-semibold text-gray-900 dark:text-white">
            Business logo
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            1:1 crop, displayed as a circle.
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
                alt="Business logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-300">
                No logo
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
                  <span>{logoUrl ? "Replace logo" : "Upload logo"}</span>
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
                    toast.error(err?.message || "Failed to remove logo")
                  )
                }
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 space-y-4">
        <div className="space-y-1">
          <div className="font-semibold text-gray-900 dark:text-white">
            Business banner
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Wide crop, used as the header background in the admin app and public
            booking.
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
                alt="Business banner"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-transparent" />
            {!bannerUrl ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-xs font-medium text-white/80">
                  No banner
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
                  <span>{bannerUrl ? "Replace banner" : "Upload banner"}</span>
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
                    toast.error(err?.message || "Failed to remove banner")
                  )
                }
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
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
            toast.error(err?.message || "Failed to upload image");
            throw err;
          }
        }}
      />
    </div>
  );
}
