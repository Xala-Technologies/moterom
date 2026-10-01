import { describe, expect, it } from "vitest";
import { isPortalMember, PortalAccessStore } from "../server/portalAccess";

describe("isPortalMember", () => {
  it("grants live portal entry from a Møterom grant without Digilist membership", () => {
    expect(
      isPortalMember({
        digilistMember: false,
        allowlisted: false,
        granted: true,
      }),
    ).toBe(true);
    expect(
      isPortalMember({
        digilistMember: true,
        allowlisted: false,
        granted: false,
      }),
    ).toBe(false);
    expect(
      isPortalMember({
        digilistMember: true,
        allowlisted: false,
        granted: true,
      }),
    ).toBe(true);
  });

  it("treats ADMIN_EMAILS as an implicit grant without Digilist membership", () => {
    expect(
      isPortalMember({
        digilistMember: false,
        allowlisted: true,
        granted: false,
      }),
    ).toBe(true);
  });

  it("keeps demo personas as portal members without a grant row", () => {
    expect(
      isPortalMember({
        digilistMember: true,
        allowlisted: false,
        granted: false,
        demo: true,
      }),
    ).toBe(true);
    expect(
      isPortalMember({
        digilistMember: false,
        allowlisted: false,
        granted: true,
        demo: true,
      }),
    ).toBe(false);
  });

  it("honours Moteroom grants for Digilist OTP even when DATA_MODE is demo", () => {
    // Digilist OTP on a demo BFF must not pass demo:true — grant opens the portal.
    expect(
      isPortalMember({
        digilistMember: false,
        allowlisted: false,
        granted: true,
        demo: false,
      }),
    ).toBe(true);
  });
});

describe("PortalAccessStore", () => {
  it("grants, lists, and revokes emails", () => {
    const store = new PortalAccessStore(":memory:");
    store.grant("Kari@Example.invalid", "approve");
    expect(store.has("kari@example.invalid")).toBe(true);
    store.grant("kari@example.invalid", "backfill");
    expect(store.list()).toEqual(["kari@example.invalid"]);
    store.revoke("kari@example.invalid");
    expect(store.has("kari@example.invalid")).toBe(false);
  });
});
