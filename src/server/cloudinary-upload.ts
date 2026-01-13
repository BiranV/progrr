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
    transformation.unshift({
      width: args.width,
      height: args.height,
      crop: args.crop ?? "limit",
      gravity: "auto",
    });
  }

  return cloudinary.url(pid, {
    secure: true,
    transformation,
  });
}
