import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { app } = await import("./app");
const { port } = await import("./config");
const { mountFrontend } = await import("./frontend");
await mountFrontend(app);
if (!process.env.VERCEL) {
  app.listen(port, "0.0.0.0", () =>
    console.log(`Møterom ready on port ${port}`),
  );
}
export default app;
