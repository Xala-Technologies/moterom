import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { messageUploadDir, saveMessageImage } from "../server/messageImage";

const png = Buffer.alloc(64, 0x41).toString("base64");

describe("messageUploadDir", () => {
  const previous = process.env.MESSAGE_UPLOAD_DIR;

  afterEach(() => {
    if (previous === undefined) delete process.env.MESSAGE_UPLOAD_DIR;
    else process.env.MESSAGE_UPLOAD_DIR = previous;
  });

  it("defaults to the durable .data volume", () => {
    delete process.env.MESSAGE_UPLOAD_DIR;
    expect(messageUploadDir()).toBe(
      join(process.cwd(), ".data", "message-images"),
    );
  });

  it("honours MESSAGE_UPLOAD_DIR", () => {
    process.env.MESSAGE_UPLOAD_DIR = "/var/data/message-images";
    expect(messageUploadDir()).toBe("/var/data/message-images");
  });
});

describe("saveMessageImage", () => {
  it("writes under MESSAGE_UPLOAD_DIR and returns a public URL", async () => {
    const dir = mkdtempSync(join(tmpdir(), "moterom-msg-"));
    process.env.MESSAGE_UPLOAD_DIR = dir;
    try {
      const url = await saveMessageImage({
        filename: "note.png",
        contentType: "image/png",
        data: png,
      });
      expect(url).toMatch(/^\/message-images\/msg-.+\.png$/);
    } finally {
      delete process.env.MESSAGE_UPLOAD_DIR;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
