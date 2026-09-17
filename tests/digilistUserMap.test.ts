import { describe, expect, it } from "vitest";
process.env.DATA_MODE = "demo";
process.env.DIGILIST_TENANT_ID = "building-test";
process.env.ADMIN_EMAILS = "skb@digilist.no";
const { mapDigilistUser } = await import("../server/digilist");

const building = "building-test";
const allowlisted = {
  id: "user-1",
  name: "SKB Admin",
  email: "skb@digilist.no",
  role: "user",
  tenantId: building,
  tenantRole: "member",
};
const other = {
  id: "user-2",
  name: "Ada Admin",
  email: "ada@example.invalid",
  role: "admin",
  tenantId: building,
  tenantRole: "owner",
};

describe("mapDigilistUser", () => {
  it("grants admin only when email is allowlisted and Digilist tenant role is admin-capable", () => {
    const user = mapDigilistUser(
      { ...allowlisted, tenantRole: "tenant_admin" },
      building,
    );
    expect(user.isMember).toBe(true);
    expect(user.isAdmin).toBe(true);
  });

  it("matches allowlisted email case-insensitively", () => {
    expect(
      mapDigilistUser(
        {
          ...allowlisted,
          email: "SKB@Digilist.NO",
          tenantRole: "saksbehandler",
        },
        building,
      ).isAdmin,
    ).toBe(true);
  });

  it("denies admin for Digilist tenant admins not on the allowlist", () => {
    for (const tenantRole of [
      "owner",
      "admin",
      "tenant_admin",
      "saksbehandler",
      "manager",
    ]) {
      const user = mapDigilistUser({ ...other, tenantRole }, building);
      expect(user.isMember).toBe(true);
      expect(user.isAdmin).toBe(false);
    }
  });

  it("denies admin when Digilist platform role is admin but email is not allowlisted", () => {
    const user = mapDigilistUser(
      { ...other, role: "admin", tenantRole: "member" },
      building,
    );
    expect(user.isAdmin).toBe(false);
  });

  it("denies admin for an allowlisted email without a Digilist tenant admin role", () => {
    const user = mapDigilistUser(allowlisted, building);
    expect(user.isMember).toBe(true);
    expect(user.isAdmin).toBe(false);
  });

  it("denies membership and admin when Digilist tenant does not match", () => {
    const user = mapDigilistUser(
      { ...allowlisted, tenantId: "other-tenant", tenantRole: "tenant_admin" },
      building,
    );
    expect(user.isMember).toBe(false);
    expect(user.isAdmin).toBe(false);
  });

  it("uses email as display name when Digilist name is missing", () => {
    const user = mapDigilistUser(
      { ...allowlisted, name: null, tenantRole: "member" },
      building,
    );
    expect(user.name).toBe(allowlisted.email);
  });
});
