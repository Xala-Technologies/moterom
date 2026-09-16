import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
if (existsSync(".env")) process.loadEnvFile(".env");
const { app } = await import("./app");
const { port, production } = await import("./config");
if (production) {
  app.use(express.static(resolve("dist"), { maxAge: "1h", index: false }));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: port + 1 } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(port, "0.0.0.0", () => console.log(`Møterom ready on port ${port}`));
