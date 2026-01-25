"use client";

import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SidePanel from "@/components/ui/side-panel";
import { useI18n } from "@/i18n/useI18n";
import {
  cropImageToBlob,
  cropImageToFile,
  type CropPixels,
} from "@/lib/image-crop";

export type ImageCropperMode = "logo" | "banner";

const MODE_CONFIG: Record<
  ImageCropperMode,
  {
    aspect: number;
    cropShape: "round" | "rect";
    outputWidth: number;
    outputHeight: number;
    mimeType: "image/png" | "image/jpeg";
  }
> = {
  logo: {
    aspect: 1,
    cropShape: "round",
    outputWidth: 512,
    outputHeight: 512,
    mimeType: "image/png",
  },
  // Matches current header usage: 1600x560 -> 2.857:1
  banner: {
    aspect: 1600 / 560,
    cropShape: "rect",
    outputWidth: 1600,
    outputHeight: 560,
    mimeType: "image/jpeg",
  },
};

function safeExtForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export default function ImageCropperModal({
  open,
  file,
  mode,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  file: File | null;
  mode: ImageCropperMode;
  onCancel: () => void;
  onConfirm: (cropped: File) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const cfg = MODE_CONFIG[mode];
  const title =
    mode === "logo"
      ? t("branding.cropper.logoTitle")
      : t("branding.cropper.bannerTitle");
  const hint =
    mode === "logo"
      ? t("branding.cropper.logoHint")
      : t("branding.cropper.bannerHint");
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [brightness, setBrightness] = React.useState(0);
  const [color, setColor] = React.useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    React.useState<CropPixels | null>(null);
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!open || !file) {
      setImageSrc(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  React.useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setBrightness(0);
    setColor(0);
    setCroppedAreaPixels(null);
  }, [open, mode]);

  React.useEffect(() => {
    if (!open) return;
    if (!imageSrc) return;
    if (!croppedAreaPixels) return;

    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const blob = await cropImageToBlob({
            imageSrc,
            crop: croppedAreaPixels,
            outputWidth: cfg.outputWidth,
            outputHeight: cfg.outputHeight,
            mimeType: cfg.mimeType,
            quality: cfg.mimeType === "image/jpeg" ? 0.9 : undefined,
            brightness: mode === "banner" ? brightness : 0,
            color: mode === "banner" ? color : 0,
          });

          if (cancelled) return;
          const nextUrl = URL.createObjectURL(blob);
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return nextUrl;
          });
        } catch {
          // Ignore preview errors; final crop will still validate.
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    cfg.mimeType,
    cfg.outputHeight,
    cfg.outputWidth,
    croppedAreaPixels,
    imageSrc,
    open,
  ]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onCropComplete = React.useCallback(
    (_croppedArea: Area, croppedPixels: Area) => {
      setCroppedAreaPixels({
        x: croppedPixels.x,
        y: croppedPixels.y,
        width: croppedPixels.width,
        height: croppedPixels.height,
      });
    },
    []
  );

  const confirm = async () => {
    if (!file) return;
    if (!imageSrc) return;
    if (!croppedAreaPixels) return;

    setIsConfirming(true);
    try {
      const ext = safeExtForMime(cfg.mimeType);
      const cropped = await cropImageToFile({
        imageSrc,
        crop: croppedAreaPixels,
        outputWidth: cfg.outputWidth,
        outputHeight: cfg.outputHeight,
        mimeType: cfg.mimeType,
        quality: cfg.mimeType === "image/jpeg" ? 0.9 : undefined,
        fileName: `${mode}-cropped.${ext}`,
        brightness: mode === "banner" ? brightness : 0,
        color: mode === "banner" ? color : 0,
      });

      await onConfirm(cropped);
    } finally {
      setIsConfirming(false);
    }
  };

  const previewBox =
    mode === "logo"
      ? "w-28 h-28 rounded-full"
      : "w-full aspect-[1600/560]";
  const previewContainerClass =
    mode === "logo"
      ? "relative overflow-hidden border bg-muted/40"
      : "relative overflow-hidden bg-transparent";
  const brightnessPercent = Math.max(50, Math.min(150, 100 + brightness));
  const saturationPercent = Math.max(
    0,
    Math.min(100, color < 0 ? 100 + (color / 15) * 100 : 100)
  );
  const bannerMediaStyle =
    mode === "banner"
      ? ({
        filter: `brightness(${brightnessPercent}%) saturate(${saturationPercent}%)`,
      } as React.CSSProperties)
      : undefined;

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      description={undefined}
      widthClassName="w-full sm:w-[720px]"
    >
      <div className="space-y-4">
        <div
          className={
            mode === "banner"
              ? "flex w-full flex-col items-start gap-4"
              : "flex w-full flex-row items-start gap-4"
          }
        >
          <div className="space-y-3 w-[240px] sm:w-[300px]">
            <div
              className={
                "relative w-full overflow-hidden " +
                (mode === "logo" ? "h-[260px]" : "h-[220px]")
              }
            >
              {imageSrc ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={cfg.aspect}
                  cropShape={cfg.cropShape}
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  zoomWithScroll
                  style={{ mediaStyle: bannerMediaStyle }}
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="crop-zoom">{t("branding.cropper.zoom")}</Label>
                <div className="text-xs text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </div>
              </div>
              <input
                id="crop-zoom"
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
                dir="ltr"
              />
            </div>

            {mode === "banner" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="crop-brightness">
                      {t("branding.cropper.brightness")}
                    </Label>
                    <div className="text-xs text-muted-foreground">
                      {brightness}
                    </div>
                  </div>
                  <input
                    id="crop-brightness"
                    type="range"
                    min={-15}
                    max={15}
                    step={1}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="crop-color">
                      {t("branding.cropper.color")}
                    </Label>
                    <div className="text-xs text-muted-foreground">
                      {color}
                    </div>
                  </div>
                  <input
                    id="crop-color"
                    type="range"
                    min={-15}
                    max={15}
                    step={1}
                    value={color}
                    onChange={(e) => setColor(Number(e.target.value))}
                    className="w-full"
                    dir="ltr"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={
              mode === "banner"
                ? "space-y-3 w-full"
                : "space-y-3 w-[200px] sm:w-[220px]"
            }
          >
            <div className="text-sm font-medium">
              {t("branding.cropper.finalPreview")}
            </div>
            <div className={previewContainerClass + " " + previewBox}>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={t("branding.cropper.previewAlt")}
                  className={
                    mode === "logo"
                      ? "h-full w-full object-cover"
                      : "h-full w-full object-contain"
                  }
                  style={bannerMediaStyle}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                  {t("branding.cropper.moveToPreview")}
                </div>
              )}
              {mode === "logo" ? (
                <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/10" />
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {hint}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={!file || !imageSrc || !croppedAreaPixels || isConfirming}
            data-panel-primary="true"
          >
            {isConfirming
              ? t("branding.cropper.cropping")
              : t("branding.cropper.useCropped")}
          </Button>
        </div>
      </div>
    </SidePanel>
  );
}
