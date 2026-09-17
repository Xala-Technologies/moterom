import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import rooms from "../config/rooms.json";
import type { Config, Room } from "../shared/types";

const env = (key: string) => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

export const production = process.env.NODE_ENV === "production";
const mode = env("DATA_MODE") ?? (production ? "live" : "demo");
if (mode !== "live" && mode !== "demo")
  throw new Error("DATA_MODE must be live or demo.");
if (production && mode === "demo" && env("ALLOW_DEMO_DEPLOYMENT") !== "true")
  throw new Error(
    "Production demo requires explicit ALLOW_DEMO_DEPLOYMENT=true.",
  );
if (production && (env("SESSION_SECRET")?.length ?? 0) < 32)
  throw new Error("SESSION_SECRET must contain at least 32 random characters.");
export const secret = env("SESSION_SECRET") || randomBytes(32).toString("hex");
export const tenantId = env("DIGILIST_TENANT_ID") ?? "";
export const convexUrl = env("DIGILIST_URL") ?? "";
export const httpUrl = (env("DIGILIST_HTTP_URL") ?? "").replace(/\/$/, "");
export const port = Number(env("PORT") ?? 4173);
export const origin = env("PUBLIC_ORIGIN") ?? `http://localhost:${port}`;
if (new URL(origin).origin !== origin)
  throw new Error(
    "PUBLIC_ORIGIN must be an origin without a path or trailing slash.",
  );
if (production && !origin.startsWith("https://"))
  throw new Error("Production requires an HTTPS PUBLIC_ORIGIN.");
const access = env("BOOKING_ACCESS") ?? "public";
if (access !== "public" && access !== "members")
  throw new Error("BOOKING_ACCESS must be public or members.");
if (
  env("PAYMENT_MODE") &&
  !["hosted", "invoice"].includes(env("PAYMENT_MODE")!)
)
  throw new Error("PAYMENT_MODE must be hosted or invoice.");
export const inventory = rooms as Room[];
export const floorplanPath = resolve(
  env("FLOORPLAN_PATH") || "assets/floor-plan.png",
);
export const digilistAuthConfigured = Boolean(convexUrl && httpUrl);

/** Lowercased Digilist emails allowed to use Møterom Admin (live Digilist sessions). */
function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}
const adminEmailsRaw = env("ADMIN_EMAILS");
export const adminEmails = parseAdminEmails(
  adminEmailsRaw ??
    (production && mode === "live" ? undefined : "skb@digilist.no"),
);
if (production && mode === "live" && adminEmails.size === 0)
  throw new Error(
    "Live production requires ADMIN_EMAILS with at least one email address.",
  );

export const config: Config = {
  floorplanAvailable: existsSync(floorplanPath),
  mode,
  buildingName: env("BUILDING_NAME") || "Møterom",
  address: env("BUILDING_ADDRESS") || "",
  contactEmail: env("CONTACT_EMAIL") || "",
  access,
  dashboardUrl:
    env("DIGILIST_DASHBOARD_URL") || "https://dashboard.digilist.no",
  digilistAuthConfigured,
};

/** True when the browser Origin is this deployment (PUBLIC_ORIGIN or request Host). */
export function isAllowedOrigin(
  requestOrigin: string | undefined,
  host?: string,
) {
  if (!requestOrigin) return false;
  if (requestOrigin === origin) return true;
  const hostname = host?.split(",")[0]?.trim();
  if (!hostname) return false;
  try {
    return new URL(requestOrigin).host === hostname;
  } catch {
    return false;
  }
}

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
