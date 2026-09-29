import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { AppError } from "../shared/validation";
import { origin } from "./config";

const TYPES: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

/** Writable upload root for demo catalogue photos; /tmp on Vercel. */
export function demoUploadDir() {
  if (process.env.DEMO_UPLOAD_DIR) return process.env.DEMO_UPLOAD_DIR;
  if (process.env.VERCEL) return "/tmp/rooms";
  return join(process.cwd(), "public", "rooms");
}

/**
 * Writable upload root for live (and shared) room photos hosted by Møterom.
 * Prefer the durable `.data` volume (Docker mounts it for the node user).
 * Vercel stays on /tmp; ROOM_UPLOAD_DIR overrides both.
 */
export function roomUploadDir() {
  if (process.env.ROOM_UPLOAD_DIR) return process.env.ROOM_UPLOAD_DIR;
  if (process.env.VERCEL) return "/tmp/room-images";
  return join(process.cwd(), ".data", "room-images");
}

function extensionFor(file: { filename: string; contentType: string }) {
  const ext = TYPES[file.contentType] || extname(file.filename).toLowerCase();
  if (!ext || !Object.values(TYPES).includes(ext))
    throw new AppError(400, "Bruk WebP, JPEG eller PNG.", "invalid_image_type");
  return ext;
}

function bufferFrom(file: { data: string }) {
  const buffer = Buffer.from(file.data, "base64");
  if (buffer.byteLength < 32 || buffer.byteLength > 2_000_000)
    throw new AppError(
      400,
      "Bildet må være mellom 32 byte og 2 MB.",
      "invalid_image_size",
    );
  return buffer;
}

function safeRoomId(roomId: string) {
  const safeId = roomId.replace(/[^a-z0-9-_]/gi, "");
  if (!safeId) throw new AppError(400, "Ugyldig rom.", "unknown_room");
  return safeId;
}

/** Demo catalogue path under /rooms/… (public or DEMO_UPLOAD_DIR). */
export async function saveDemoRoomImage(
  roomId: string,
  file: { filename: string; contentType: string; data: string },
) {
  const ext = extensionFor(file);
  const buffer = bufferFrom(file);
  const safeId = safeRoomId(roomId);
  const dir = demoUploadDir();
  await mkdir(dir, { recursive: true });
  const name = `${safeId}-${Date.now()}${ext}`;
  await writeFile(join(dir, name), buffer);
  return `/rooms/${name}`;
}

/**
 * Persist a room photo on the Møterom BFF (not Digilist media).
 * Returns a public path under /room-images/….
 */
export async function saveRoomImage(
  roomId: string,
  file: { filename: string; contentType: string; data: string },
) {
  const ext = extensionFor(file);
  const buffer = bufferFrom(file);
  const safeId = safeRoomId(roomId);
  const dir = roomUploadDir();
  try {
    await mkdir(dir, { recursive: true });
    const name = `${safeId}-${Date.now()}${ext}`;
    await writeFile(join(dir, name), buffer);
    return `/room-images/${name}`;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "Bildet kunne ikke lagres. Prøv igjen.",
      "room_image_store_failed",
    );
  }
}

/** Absolute HTTPS (or local) URL Digilist can store as a resource image reference. */
export function publicRoomImageUrl(pathOrUrl: string): string {
  const value = pathOrUrl.trim();
  if (/^https:\/\//.test(value)) return value;
  if (/^http:\/\/localhost(?::\d+)?\//.test(value)) return value;
  if (!value.startsWith("/"))
    throw new AppError(
      400,
      "Bruk en HTTPS-adresse til bildet.",
      "invalid_image_url",
    );
  return `${origin}${value}`;
}
