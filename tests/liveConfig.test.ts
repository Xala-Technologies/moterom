import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATA_MODE", "live");
  vi.stubEnv(
    "SESSION_SECRET",
    "test-only-secret-that-is-not-a-production-secret",
  );
  vi.stubEnv("PUBLIC_ORIGIN", "https://skb.example.invalid");
  vi.stubEnv("DIGILIST_URL", "https://example.convex.cloud");
  vi.stubEnv("DIGILIST_HTTP_URL", "https://api.example.invalid");
  vi.stubEnv("DIGILIST_TENANT_ID", "test-tenant");
  vi.stubEnv("ADMIN_EMAILS", "admin@example.invalid");
  vi.stubEnv("BOOKING_ACCESS", "members");
  vi.stubEnv("PAYMENT_MODE", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("SKB production configuration", () => {
  it("ignores forged Host and forwarded Host origins in production", async () => {
    const { isAllowedOrigin } = await import("../server/config");
    expect(
      isAllowedOrigin("https://skb.example.invalid", "proxy.internal"),
    ).toBe(true);
    expect(
      isAllowedOrigin("https://attacker.invalid", "attacker.invalid"),
    ).toBe(false);
    expect(
      isAllowedOrigin("http://skb.example.invalid", "skb.example.invalid"),
    ).toBe(false);
  });
  it("defaults live access to members and refuses public access", async () => {
    vi.stubEnv("BOOKING_ACCESS", "");
    expect((await import("../server/config")).config.access).toBe("members");
    vi.resetModules();
    vi.stubEnv("BOOKING_ACCESS", "public");
    await expect(import("../server/config")).rejects.toThrow(
      "BOOKING_ACCESS=members",
    );
  });
  it.each(["invoice", "hosted"])("refuses payment mode %s", async (mode) => {
    vi.stubEnv("PAYMENT_MODE", mode);
    await expect(import("../server/config")).rejects.toThrow("no payments");
  });
});
