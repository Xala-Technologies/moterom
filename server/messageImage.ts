import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError, type MessageImageFile } from "../shared/validation";

const TYPES: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

/** Writable upload root for chat images; /tmp on Vercel. */
export function messageUploadDir() {
  if (process.env.MESSAGE_UPLOAD_DIR) return process.env.MESSAGE_UPLOAD_DIR;
  if (process.env.VERCEL) return "/tmp/message-images";
  return join(process.cwd(), "public", "message-images");
}

export async function saveMessageImage(file: MessageImageFile) {
  const ext = TYPES[file.contentType] || extname(file.filename).toLowerCase();
  if (!ext || !Object.values(TYPES).includes(ext))
    throw new AppError(400, "Bruk WebP, JPEG eller PNG.", "invalid_image_type");
  const buffer = Buffer.from(file.data, "base64");
  if (buffer.byteLength < 32 || buffer.byteLength > 2_000_000)
    throw new AppError(
      400,
      "Bildet må være mellom 32 byte og 2 MB.",
      "invalid_image_size",
    );
  const dir = messageUploadDir();
  await mkdir(dir, { recursive: true });
  const name = `msg-${randomUUID()}${ext}`;
  await writeFile(join(dir, name), buffer);
  return `/message-images/${name}`;
}
