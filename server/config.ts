import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import rooms from "../config/rooms.json";
import type { Config, Room } from "../shared/types";
export const production = process.env.NODE_ENV === "production";
const mode = process.env.DATA_MODE ?? (production ? "live" : "demo");
if (mode !== "live" && mode !== "demo")
  throw new Error("DATA_MODE must be live or demo.");
if (
  production &&
  mode === "demo" &&
  process.env.ALLOW_DEMO_DEPLOYMENT !== "true"
)
  throw new Error(
    "Production demo requires explicit ALLOW_DEMO_DEPLOYMENT=true.",
  );
if (production && (process.env.SESSION_SECRET?.length ?? 0) < 32)
  throw new Error("SESSION_SECRET must contain at least 32 random characters.");
export const secret =
  process.env.SESSION_SECRET || randomBytes(32).toString("hex");
export const tenantId = process.env.DIGILIST_TENANT_ID ?? "";
export const convexUrl = process.env.DIGILIST_URL ?? "";
export const httpUrl = (process.env.DIGILIST_HTTP_URL ?? "").replace(/\/$/, "");
export const port = Number(process.env.PORT ?? 4173);
export const origin = process.env.PUBLIC_ORIGIN ?? `http://localhost:${port}`;
if (new URL(origin).origin !== origin)
  throw new Error(
    "PUBLIC_ORIGIN must be an origin without a path or trailing slash.",
  );
if (production && !origin.startsWith("https://"))
  throw new Error("Production requires an HTTPS PUBLIC_ORIGIN.");
const access = process.env.BOOKING_ACCESS ?? "public";
if (access !== "public" && access !== "members")
  throw new Error("BOOKING_ACCESS must be public or members.");
if (
  process.env.PAYMENT_MODE &&
  !["hosted", "invoice"].includes(process.env.PAYMENT_MODE)
)
  throw new Error("PAYMENT_MODE must be hosted or invoice.");
export const inventory = rooms as Room[];
export const floorplanPath = resolve(
  process.env.FLOORPLAN_PATH || "assets/floor-plan.png",
);
export const config: Config = {
  floorplanAvailable: existsSync(floorplanPath),
  mode,
  buildingName: process.env.BUILDING_NAME || "Møterom",
  address: process.env.BUILDING_ADDRESS || "",
  contactEmail: process.env.CONTACT_EMAIL || "",
  access,
  dashboardUrl:
    process.env.DIGILIST_DASHBOARD_URL || "https://dashboard.digilist.no",
};
if (
  mode === "live" &&
  (!tenantId || !convexUrl || !httpUrl || inventory.some((r) => !r.slug))
)
  throw new Error(
    "Live mode requires tenant ID, both Digilist URLs, and a live slug for each room in config/rooms.json.",
  );
if (
  mode === "live" &&
  [convexUrl, httpUrl, config.dashboardUrl].some(
    (url) => !url.startsWith("https://"),
  )
)
  throw new Error("Live Digilist URLs must use HTTPS.");
