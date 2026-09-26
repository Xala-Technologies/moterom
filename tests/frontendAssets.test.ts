import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  isStaticAssetPath,
  mountMissingAssetNotFound,
  sendMissingAsset,
} from "../server/frontend";

describe("static asset paths vs SPA fallthrough", () => {
  let root = "";

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = "";
  });

  it("detects image and bundle extensions as static assets", () => {
    expect(isStaticAssetPath("/rooms/sauda-1.webp")).toBe(true);
    expect(isStaticAssetPath("/message-images/note.jpg")).toBe(true);
    expect(isStaticAssetPath("/assets/index-abc.js")).toBe(true);
    expect(isStaticAssetPath("/bookings")).toBe(false);
    expect(isStaticAssetPath("/rom/sauda-1")).toBe(false);
  });

  it("returns plain 404 for missing /rooms and /message-images instead of SPA HTML", async () => {
    root = mkdtempSync(join(tmpdir(), "moterom-assets-"));
    mkdirSync(join(root, "rooms"));
    mkdirSync(join(root, "message-images"));
    writeFileSync(join(root, "rooms", "ok.webp"), "webp-bytes");
    writeFileSync(
      join(root, "index.html"),
      "<!doctype html><title>spa</title>",
    );

    const app = express();
    app.use(
      "/rooms",
      express.static(join(root, "rooms"), { fallthrough: true }),
    );
    app.use(
      "/message-images",
      express.static(join(root, "message-images"), { fallthrough: true }),
    );
    app.use(express.static(root, { index: false }));
    mountMissingAssetNotFound(app);
    app.get("/{*path}", (req, res) => {
      if (isStaticAssetPath(req.path)) return sendMissingAsset(req, res);
      res.sendFile(join(root, "index.html"));
    });

    const existing = await request(app).get("/rooms/ok.webp").expect(200);
    expect(Buffer.from(existing.body).toString()).toBe("webp-bytes");

    const missingRoom = await request(app)
      .get("/rooms/missing.webp")
      .expect(404);
    expect(missingRoom.headers["content-type"]).toMatch(/text\/plain/);
    expect(missingRoom.text).toBe("Not found");
    expect(missingRoom.text).not.toMatch(/spa/i);

    const missingMessage = await request(app)
      .get("/message-images/gone.jpg")
      .expect(404);
    expect(missingMessage.text).toBe("Not found");

    const spa = await request(app).get("/bookings").expect(200);
    expect(spa.text).toMatch(/spa/);

    const missingJs = await request(app).get("/assets/nope.js").expect(404);
    expect(missingJs.text).toBe("Not found");
  });
});
