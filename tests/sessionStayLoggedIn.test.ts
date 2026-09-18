import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Response } from "express";
import { AppError } from "../shared/validation";

process.env.DATA_MODE = "live";
process.env.DIGILIST_URL = "https://example.convex.cloud";
process.env.DIGILIST_HTTP_URL = "https://api.example.test";
process.env.DIGILIST_TENANT_ID = "tenant-test";
process.env.ADMIN_EMAILS = "admin@example.invalid";
process.env.BOOKING_ACCESS = "members";
process.env.SESSION_SECRET = "test-only-secret-that-is-not-a-production-secret";
process.env.PUBLIC_ORIGIN = "http://localhost:4173";
process.env.FLOORPLAN_PATH = "/nonexistent-moterom-test-floorplan.png";
process.env.ACCESS_REQUESTS_DB_PATH = ":memory:";

const digilistMocks = vi.hoisted(() => ({
  liveUser: vi.fn(),
  refreshAccess: vi.fn(),
}));

vi.mock("../server/digilist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/digilist")>();
  return {
    ...actual,
    liveUser: digilistMocks.liveUser,
    refreshAccess: digilistMocks.refreshAccess,
  };
});

const { app } = await import("../server/app");
const { writeSession, cookieName } = await import("../server/session");

const member = {
  id: "user-1",
  name: "Kari",
  email: "kari@example.invalid",
  isAdmin: false,
  isMember: true,
};

async function sessionCookie(token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const capture = {
      cookie(name: string, value: string) {
        resolve(`${name}=${value}`);
      },
    } as unknown as Response;
    writeSession(capture, { token, rememberMe: true }).catch(reject);
  });
}

function parseSetCookie(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

describe("/api/session stay-logged-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    digilistMocks.liveUser.mockResolvedValue(member);
  });

  it("keeps the cookie when liveUser works but access-token refresh returns 401", async () => {
    digilistMocks.refreshAccess.mockRejectedValue(
      new AppError(
        401,
        "Økten er utløpt. Logg inn på nytt.",
        "session_expired",
      ),
    );

    const response = await request(app)
      .get("/api/session")
      .set("Cookie", await sessionCookie("digilist-session-token"))
      .expect(200);

    expect(response.body.user).toMatchObject({
      id: "user-1",
      email: "kari@example.invalid",
    });
    expect(digilistMocks.liveUser).toHaveBeenCalled();
    expect(digilistMocks.refreshAccess).toHaveBeenCalled();

    const cleared = parseSetCookie(response.headers["set-cookie"]).some(
      (c) =>
        c.startsWith(`${cookieName}=`) &&
        (c.includes("Max-Age=0") || /=;/.test(c.split(";")[0] ?? "")),
    );
    expect(cleared).toBe(false);
  });

  it("clears the cookie when Digilist /auth/me says the session is gone", async () => {
    digilistMocks.liveUser.mockRejectedValue(
      new AppError(
        401,
        "Økten er utløpt. Logg inn på nytt.",
        "session_expired",
      ),
    );

    const response = await request(app)
      .get("/api/session")
      .set("Cookie", await sessionCookie("expired-digilist-token"))
      .expect(200);

    expect(response.body.user).toBeNull();
    const cleared = parseSetCookie(response.headers["set-cookie"]).some((c) =>
      c.startsWith(`${cookieName}=`),
    );
    expect(cleared).toBe(true);
  });
});
