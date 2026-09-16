import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { AppError } from "../shared/validation";

const TYPES: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

/** Writable upload root; /tmp on Vercel where the deploy filesystem is read-only. */
export function demoUploadDir() {
  if (process.env.DEMO_UPLOAD_DIR) return process.env.DEMO_UPLOAD_DIR;
  if (process.env.VERCEL) return "/tmp/rooms";
  return join(process.cwd(), "public", "rooms");
}

export async function saveDemoRoomImage(
  roomId: string,
  file: { filename: string; contentType: string; data: string },
) {
  const ext = TYPES[file.contentType] || extname(file.filename).toLowerCase();
  if (!ext || !Object.values(TYPES).includes(ext))
    throw new AppError(400, "Bruk WebP, JPEG eller PNG.", "invalid_image_type");
  const safeId = roomId.replace(/[^a-z0-9-_]/gi, "");
  if (!safeId) throw new AppError(400, "Ugyldig rom.", "unknown_room");
  const buffer = Buffer.from(file.data, "base64");
  if (buffer.byteLength < 32 || buffer.byteLength > 2_000_000)
    throw new AppError(
      400,
      "Bildet må være mellom 32 byte og 2 MB.",
      "invalid_image_size",
    );
  const dir = demoUploadDir();
  await mkdir(dir, { recursive: true });
  const name = `${safeId}-${Date.now()}${ext}`;
  await writeFile(join(dir, name), buffer);
  return `/rooms/${name}`;
}
