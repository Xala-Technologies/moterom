import { describe, expect, it } from "vitest";
import { isPortalMember, PortalAccessStore } from "../server/portalAccess";

describe("isPortalMember", () => {
  it("requires Digilist membership and a Møterom grant", () => {
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
    expect(
      isPortalMember({
        digilistMember: false,
        allowlisted: false,
        granted: true,
      }),
    ).toBe(false);
  });

  it("treats ADMIN_EMAILS as an implicit grant when Digilist membership exists", () => {
    expect(
      isPortalMember({
        digilistMember: true,
        allowlisted: true,
        granted: false,
      }),
    ).toBe(true);
  });

  it("keeps demo Digilist members as portal members without a grant row", () => {
    expect(
      isPortalMember({
        digilistMember: true,
        allowlisted: false,
        granted: false,
        demo: true,
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
