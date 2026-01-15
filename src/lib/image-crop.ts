export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function createImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

export async function cropImageToBlob(options: {
  imageSrc: string;
  crop: CropPixels;
  outputWidth: number;
  outputHeight: number;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  quality?: number;
}): Promise<Blob> {
  const { imageSrc, crop, outputWidth, outputHeight, mimeType } = options;
  const quality =
    typeof options.quality === "number"
      ? options.quality
      : mimeType === "image/jpeg"
      ? 0.9
      : 0.92;

  const img = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = clampInt(outputWidth);
  canvas.height = clampInt(outputHeight);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  const sx = clampInt(crop.x);
  const sy = clampInt(crop.y);
  const sWidth = clampInt(crop.width);
  const sHeight = clampInt(crop.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    sx,
    sy,
    sWidth,
    sHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      mimeType,
      mimeType === "image/png" ? undefined : quality
    );
  });

  if (!blob) throw new Error("Failed to generate cropped image");
  return blob;
}

export async function cropImageToFile(options: {
  imageSrc: string;
  crop: CropPixels;
  outputWidth: number;
  outputHeight: number;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  fileName: string;
  quality?: number;
}): Promise<File> {
  const blob = await cropImageToBlob(options);
  return new File([blob], options.fileName, { type: options.mimeType });
}
