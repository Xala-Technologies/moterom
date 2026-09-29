import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  publicRoomImageUrl,
  roomUploadDir,
  saveRoomImage,
} from "../server/roomImage";
import { origin } from "../server/config";

const png = Buffer.alloc(64, 0x41).toString("base64");

describe("roomUploadDir", () => {
  const previous = process.env.ROOM_UPLOAD_DIR;

  afterEach(() => {
    if (previous === undefined) delete process.env.ROOM_UPLOAD_DIR;
    else process.env.ROOM_UPLOAD_DIR = previous;
  });

  it("defaults to the durable .data volume", () => {
    delete process.env.ROOM_UPLOAD_DIR;
    expect(roomUploadDir()).toBe(join(process.cwd(), ".data", "room-images"));
  });

  it("honours ROOM_UPLOAD_DIR", () => {
    process.env.ROOM_UPLOAD_DIR = "/var/data/room-images";
    expect(roomUploadDir()).toBe("/var/data/room-images");
  });
});

describe("saveRoomImage", () => {
  it("writes under ROOM_UPLOAD_DIR and returns a public path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "moterom-room-"));
    process.env.ROOM_UPLOAD_DIR = dir;
    try {
      const url = await saveRoomImage("sauda-1", {
        filename: "room.png",
        contentType: "image/png",
        data: png,
      });
      expect(url).toMatch(/^\/room-images\/sauda-1-\d+\.png$/);
    } finally {
      delete process.env.ROOM_UPLOAD_DIR;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("publicRoomImageUrl", () => {
  it("absolutises Møterom-hosted paths with PUBLIC_ORIGIN", () => {
    expect(publicRoomImageUrl("/room-images/sauda-1-1.png")).toBe(
      `${origin}/room-images/sauda-1-1.png`,
    );
  });

  it("passes through existing HTTPS urls", () => {
    expect(publicRoomImageUrl("https://images.example.invalid/room.webp")).toBe(
      "https://images.example.invalid/room.webp",
    );
  });
});
