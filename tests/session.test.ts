import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { jwtDecrypt } from "jose";
import type { Response } from "express";

process.env.DATA_MODE = "demo";
process.env.SESSION_SECRET = "test-only-secret-that-is-not-a-production-secret";
process.env.PUBLIC_ORIGIN = "http://localhost:4173";
process.env.FLOORPLAN_PATH = "/nonexistent-moterom-test-floorplan.png";

const {
  writeSession,
  readSession,
  durableSession,
  SESSION_MAX_AGE_MS,
  SESSION_SHORT_AGE_MS,
  cookieName,
} = await import("../server/session");

const key = createHash("sha256").update(process.env.SESSION_SECRET!).digest();

function mockRes() {
  let setCookie: {
    name: string;
    value: string;
    maxAge?: number;
  } | null = null;
  const res = {
    cookie(name: string, value: string, options: { maxAge?: number }) {
      setCookie = { name, value, maxAge: options.maxAge };
    },
  } as unknown as Response;
  return {
    res,
    get cookie() {
      return setCookie;
    },
  };
}

function mockReq(cookieHeader?: string) {
  return {
    headers: { cookie: cookieHeader },
  } as Parameters<typeof readSession>[0];
}

describe("durableSession", () => {
  it("keeps Digilist token and rememberMe, drops access JWT claims", () => {
    expect(
      durableSession({
        token: "digilist-session",
        accessToken: "short-lived",
        expiresAt: Date.now() + 60_000,
        rememberMe: true,
        demoRole: "customer",
      }),
    ).toEqual({
      token: "digilist-session",
      rememberMe: true,
      demoRole: "customer",
    });
  });

  it("defaults rememberMe to true", () => {
    expect(durableSession({ token: "x" }).rememberMe).toBe(true);
  });
});

describe("writeSession cookie TTL", () => {
  it("issues a ~30 day cookie when rememberMe is true", async () => {
    const mock = mockRes();
    await writeSession(mock.res, {
      token: "session-token",
      rememberMe: true,
      accessToken: "should-not-persist",
      expiresAt: Date.now() + 60_000,
    });
    expect(mock.cookie?.name).toBe(cookieName);
    expect(mock.cookie?.maxAge).toBe(SESSION_MAX_AGE_MS);
    const payload = (
      await jwtDecrypt(mock.cookie!.value, key, {
        issuer: "moterom",
        audience: "session",
      })
    ).payload;
    expect(payload.token).toBe("session-token");
    expect(payload.rememberMe).toBe(true);
    expect(payload.accessToken).toBeUndefined();
    expect(payload.expiresAt).toBeUndefined();
    const lifetimeSec = Number(payload.exp) - Number(payload.iat);
    expect(lifetimeSec).toBeGreaterThan(29 * 24 * 60 * 60);
    expect(lifetimeSec).toBeLessThanOrEqual(30 * 24 * 60 * 60);
  });

  it("issues an ~8 hour cookie when rememberMe is false", async () => {
    const mock = mockRes();
    await writeSession(mock.res, {
      token: "session-token",
      rememberMe: false,
    });
    expect(mock.cookie?.maxAge).toBe(SESSION_SHORT_AGE_MS);
    const payload = (
      await jwtDecrypt(mock.cookie!.value, key, {
        issuer: "moterom",
        audience: "session",
      })
    ).payload;
    const lifetimeSec = Number(payload.exp) - Number(payload.iat);
    expect(lifetimeSec).toBeGreaterThan(7 * 60 * 60);
    expect(lifetimeSec).toBeLessThanOrEqual(8 * 60 * 60);
  });

  it("round-trips token and rememberMe through readSession", async () => {
    const mock = mockRes();
    await writeSession(mock.res, {
      token: "round-trip",
      rememberMe: true,
    });
    const session = await readSession(
      mockReq(`${cookieName}=${mock.cookie!.value}`),
    );
    expect(session).toEqual({
      token: "round-trip",
      rememberMe: true,
    });
  });

  it("preserves rememberMe across rewrite without JWT registered claims leaking", async () => {
    const first = mockRes();
    await writeSession(first.res, {
      token: "keep",
      rememberMe: true,
      accessToken: "old",
      expiresAt: 1,
    });
    const read = await readSession(
      mockReq(`${cookieName}=${first.cookie!.value}`),
    );
    const second = mockRes();
    await writeSession(second.res, {
      ...read!,
      accessToken: "new-access",
      expiresAt: Date.now() + 600_000,
    });
    const payload = (
      await jwtDecrypt(second.cookie!.value, key, {
        issuer: "moterom",
        audience: "session",
      })
    ).payload;
    expect(payload).toMatchObject({ token: "keep", rememberMe: true });
    expect(payload.accessToken).toBeUndefined();
    expect(Object.keys(payload).sort()).toEqual(
      ["aud", "exp", "iat", "iss", "rememberMe", "token"].sort(),
    );
  });
});
