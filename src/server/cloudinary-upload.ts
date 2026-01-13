import { Readable } from "stream";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import { getCloudinary } from "@/server/cloudinary";

export async function uploadImageBuffer(
  buffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> {
  const cloudinary = getCloudinary();

  return await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "image", ...options },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

export async function destroyImage(publicId: string) {
  const cloudinary = getCloudinary();
  const pid = String(publicId || "").trim();
  if (!pid) return;
  await cloudinary.uploader.destroy(pid, { resource_type: "image" });
}

export function cloudinaryUrl(
  publicId: string,
  args: {
    width?: number;
    height?: number;
    crop?: "fill" | "limit";
  } = {}
) {
  const cloudinary = getCloudinary();
  const pid = String(publicId || "").trim();
  if (!pid) return "";

  const transformation: any[] = [{ quality: "auto", fetch_format: "auto" }];

  if (args.width || args.height) {
    const resize: Record<string, any> = {
      crop: args.crop ?? "limit",
    };
    if (typeof args.width === "number") resize.width = args.width;
    if (typeof args.height === "number") resize.height = args.height;
    if ((args.crop ?? "limit") === "fill") resize.gravity = "auto";

    transformation.unshift(resize);
  }

  return cloudinary.url(pid, {
    secure: true,
    transformation,
  });
}
