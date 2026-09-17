import { describe, expect, it } from "vitest";
process.env.DATA_MODE = "demo";
process.env.DIGILIST_TENANT_ID = "building-test";
const { mapDigilistUser } = await import("../server/digilist");

const building = "building-test";
const base = {
  id: "user-1",
  name: "Ada Admin",
  email: "ada@example.invalid",
  role: "user",
  tenantId: building,
  tenantRole: "member",
};

describe("mapDigilistUser", () => {
  it("grants admin for Digilist tenant admin roles", () => {
    for (const tenantRole of [
      "owner",
      "admin",
      "tenant_admin",
      "saksbehandler",
      "manager",
    ]) {
      const user = mapDigilistUser({ ...base, tenantRole }, building);
      expect(user.isMember).toBe(true);
      expect(user.isAdmin).toBe(true);
    }
  });

  it("grants admin when Digilist platform role is admin and tenant matches", () => {
    const user = mapDigilistUser(
      { ...base, role: "admin", tenantRole: "member" },
      building,
    );
    expect(user.isAdmin).toBe(true);
  });

  it("normalizes role casing and whitespace", () => {
    expect(
      mapDigilistUser({ ...base, tenantRole: " Owner " }, building).isAdmin,
    ).toBe(true);
    expect(
      mapDigilistUser({ ...base, role: "ADMIN", tenantRole: null }, building)
        .isAdmin,
    ).toBe(true);
  });

  it("denies admin for member-only roles on the building tenant", () => {
    const user = mapDigilistUser(
      { ...base, role: "user", tenantRole: "member" },
      building,
    );
    expect(user.isMember).toBe(true);
    expect(user.isAdmin).toBe(false);
  });

  it("denies admin when tenant does not match the building", () => {
    const user = mapDigilistUser(
      { ...base, tenantId: "other-tenant", tenantRole: "owner" },
      building,
    );
    expect(user.isMember).toBe(false);
    expect(user.isAdmin).toBe(false);
  });

  it("uses email as display name when Digilist name is missing", () => {
    const user = mapDigilistUser(
      { ...base, name: null, tenantRole: "owner" },
      building,
    );
    expect(user.name).toBe(base.email);
  });
});
