import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRUST_MS,
  isLoginIdentifierTrusted,
  readLoginEmails,
  rememberDeviceAfterLogin,
  rememberLoginEmail,
  REMEMBER_TRUST_MS,
  trustLoginIdentifier,
} from "../src/loginHistory";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memory = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  vi.stubGlobal("localStorage", memory);
}

describe("login device trust", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("marks an email trusted for the opted-in 30-day window", () => {
    rememberDeviceAfterLogin({
      email: "kari@example.invalid",
      stayLoggedIn: true,
    });
    expect(isLoginIdentifierTrusted("kari@example.invalid", "email")).toBe(
      true,
    );
    vi.advanceTimersByTime(REMEMBER_TRUST_MS - 1000);
    expect(isLoginIdentifierTrusted("kari@example.invalid", "email")).toBe(
      true,
    );
    vi.advanceTimersByTime(2000);
    expect(isLoginIdentifierTrusted("kari@example.invalid", "email")).toBe(
      false,
    );
  });

  it("uses Digilist silent 7-day window when stay-logged-in is off", () => {
    rememberDeviceAfterLogin({
      email: "kari@example.invalid",
      stayLoggedIn: false,
    });
    vi.advanceTimersByTime(DEFAULT_TRUST_MS - 1000);
    expect(isLoginIdentifierTrusted("kari@example.invalid", "email")).toBe(
      true,
    );
    vi.advanceTimersByTime(2000);
    expect(isLoginIdentifierTrusted("kari@example.invalid", "email")).toBe(
      false,
    );
  });

  it("keeps the longer window when trust is refreshed", () => {
    trustLoginIdentifier("kari@example.invalid", "email", DEFAULT_TRUST_MS);
    trustLoginIdentifier("kari@example.invalid", "email", REMEMBER_TRUST_MS);
    vi.advanceTimersByTime(DEFAULT_TRUST_MS + 1000);
    expect(isLoginIdentifierTrusted("kari@example.invalid", "email")).toBe(
      true,
    );
  });

  it("normalizes phone numbers for trust lookups", () => {
    rememberDeviceAfterLogin({
      phone: "413 51 547",
      stayLoggedIn: true,
    });
    expect(isLoginIdentifierTrusted("41351547", "phone")).toBe(true);
  });

  it("merges Digilist remembered emails into the one-tap list", () => {
    localStorage.setItem(
      "digilist_remembered_emails",
      JSON.stringify(["admin@skb.example", "kari@example.invalid"]),
    );
    rememberLoginEmail("kari@example.invalid");
    expect(readLoginEmails()[0]).toBe("kari@example.invalid");
    expect(readLoginEmails()).toContain("admin@skb.example");
    expect(
      JSON.parse(localStorage.getItem("digilist_remembered_emails") || "[]"),
    ).toContain("kari@example.invalid");
  });
});
