import { beforeEach, describe, expect, it, vi } from "vitest";
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
process.env.PORTAL_ROLES_DB_PATH = ":memory:";
process.env.MESSAGING_LOCAL_DB_PATH = ":memory:";

const digilistMocks = vi.hoisted(() => ({
  action: vi.fn(),
  setBuildingContext: vi.fn(),
  writeSession: vi.fn(),
}));

vi.mock("../server/digilist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/digilist")>();
  return {
    ...actual,
    action: digilistMocks.action,
    setBuildingContext: digilistMocks.setBuildingContext,
    client: () => ({}),
  };
});

vi.mock("../server/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/session")>();
  return {
    ...actual,
    writeSession: digilistMocks.writeSession,
  };
});

const { app } = await import("../server/app");
const request = (await import("supertest")).default;

describe("POST /api/auth/trusted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    digilistMocks.setBuildingContext.mockResolvedValue(undefined);
    digilistMocks.writeSession.mockImplementation(
      async (_res: Response, _session: unknown) => undefined,
    );
  });

  it("creates a Moterom session from Digilist trustedEmailLogin", async () => {
    digilistMocks.action.mockResolvedValue({
      success: true,
      sessionToken: "trusted-session-token",
    });

    const response = await request(app)
      .post("/api/auth/trusted")
      .set("Origin", "http://localhost:4173")
      .send({ email: "kari@example.invalid", rememberMe: true })
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(digilistMocks.action).toHaveBeenCalledWith(
      expect.anything(),
      "auth/emailCode:trustedEmailLogin",
      { email: "kari@example.invalid", appId: "mobile" },
    );
    expect(digilistMocks.writeSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        token: "trusted-session-token",
        rememberMe: true,
      }),
    );
  });

  it("returns MFA challenge when Digilist requires a second factor", async () => {
    digilistMocks.action.mockResolvedValue({
      success: true,
      requiresMfa: true,
      mfaChallengeId: "mfa-1",
    });

    const response = await request(app)
      .post("/api/auth/trusted")
      .set("Origin", "http://localhost:4173")
      .send({ email: "kari@example.invalid" })
      .expect(200);

    expect(response.body).toEqual({ mfaChallengeId: "mfa-1" });
    expect(digilistMocks.writeSession).not.toHaveBeenCalled();
  });

  it("fails closed when Digilist rejects trusted login", async () => {
    digilistMocks.action.mockResolvedValue({
      success: false,
      error: "Ny bruker — kode påkrevd",
    });

    const response = await request(app)
      .post("/api/auth/trusted")
      .set("Origin", "http://localhost:4173")
      .send({ email: "new@example.invalid" })
      .expect(401);

    expect(response.body.code).toBe("trusted_login_unavailable");
    expect(digilistMocks.writeSession).not.toHaveBeenCalled();
  });

  it("maps Convex action failures to AppError", async () => {
    digilistMocks.action.mockRejectedValue(
      new AppError(503, "Digilist utilgjengelig", "digilist_unavailable"),
    );

    await request(app)
      .post("/api/auth/trusted")
      .set("Origin", "http://localhost:4173")
      .send({ email: "kari@example.invalid" })
      .expect(503);
  });
});
