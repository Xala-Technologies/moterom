import { resolve } from "node:path";
import express, { type Express } from "express";
import { demoUploadDir } from "./roomImage";
import { messageUploadDir } from "./messageImage";
import { config, port, production } from "./config";

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
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
    return;
  }
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: port + 1 } },
    appType: "spa",
  });
  app.use(
    "/message-images",
    express.static(messageUploadDir(), { fallthrough: true }),
  );
  app.use(vite.middlewares);
}
