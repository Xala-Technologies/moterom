import { join, resolve } from "node:path";
import express, { type Express, type Request, type Response } from "express";
import { demoUploadDir } from "./roomImage";
import { messageUploadDir } from "./messageImage";
import { config, port, production } from "./config";

/** Plain 404 for missing static assets — never the SPA shell. */
export function sendMissingAsset(_req: Request, res: Response) {
  res.status(404).type("text/plain").send("Not found");
}

/** Paths that must not be rewritten to index.html. */
export function isStaticAssetPath(path: string): boolean {
  return /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|js|css|map|txt)$/i.test(
    path,
  );
}

/**
 * After static mounts for /rooms and /message-images: terminate with 404 so the
 * SPA catch-all cannot return HTML for a missing image URL.
 */
export function mountMissingAssetNotFound(app: Express) {
  app.use("/rooms", sendMissingAsset);
  app.use("/message-images", sendMissingAsset);
}

function uniqueDirs(dirs: string[]): string[] {
  return [...new Set(dirs)];
}

function roomStaticDirs(extra?: string): string[] {
  const dirs = [demoUploadDir()];
  const catalogue = join(process.cwd(), "public", "rooms");
  dirs.push(catalogue);
  if (extra) dirs.push(extra);
  return uniqueDirs(dirs);
}

/** Mount Vite (dev) or built SPA + demo upload dir (production). */
export async function mountFrontend(app: Express) {
  if (production) {
    if (config.mode === "demo") {
      app.use("/rooms", express.static(demoUploadDir(), { fallthrough: true }));
    }
    app.use(
      "/message-images",
      express.static(messageUploadDir(), { fallthrough: true }),
    );
    app.use(express.static(resolve("dist"), { maxAge: "1h", index: false }));
    mountMissingAssetNotFound(app);
    app.get("/{*path}", (req, res) => {
      if (isStaticAssetPath(req.path)) return sendMissingAsset(req, res);
      res.sendFile(resolve("dist/index.html"));
    });
    return;
  }
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: port + 1 } },
    appType: "spa",
  });
  for (const dir of roomStaticDirs()) {
    app.use("/rooms", express.static(dir, { fallthrough: true }));
  }
  app.use(
    "/message-images",
    express.static(messageUploadDir(), { fallthrough: true }),
  );
  mountMissingAssetNotFound(app);
  app.use(vite.middlewares);
}
