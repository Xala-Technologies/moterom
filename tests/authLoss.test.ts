import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("api auth-loss recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invokes the auth-loss handler once for parallel login_required responses", async () => {
    const handler = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: "Logg inn for å fortsette.",
          code: "login_required",
        }),
        status: 401,
      }),
    );

    const { api, setAuthLossHandler, resetAuthLossGuard } =
      await import("../src/api");
    setAuthLossHandler(handler);
    resetAuthLossGuard();

    await Promise.all([
      api("/admin").catch(() => undefined),
      api("/bookings").catch(() => undefined),
      api("/messages").catch(() => undefined),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("invokes the handler for session_expired and ignores other 401 codes", async () => {
    const handler = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: "Økten er utløpt. Logg inn på nytt.",
          code: "session_expired",
        }),
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: "Logg inn med engangskode.",
          code: "trusted_login_unavailable",
        }),
        status: 401,
      });
    vi.stubGlobal("fetch", fetchMock);

    const { api, setAuthLossHandler, resetAuthLossGuard, isAuthLossError } =
      await import("../src/api");
    setAuthLossHandler(handler);
    resetAuthLossGuard();

    await api("/admin").catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);

    resetAuthLossGuard();
    const second = await api("/auth/trusted").catch((error) => error);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(isAuthLossError(second)).toBe(false);
  });
});
