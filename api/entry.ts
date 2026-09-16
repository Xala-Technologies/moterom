import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { app } = await import("../server/app");
const { mountFrontend } = await import("../server/frontend");
await mountFrontend(app);
export default app;
