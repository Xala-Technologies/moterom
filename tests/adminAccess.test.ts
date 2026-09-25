import { describe, expect, it } from "vitest";
import {
  adminAccessForTenantRole,
  canManageOperations,
  canManagePortal,
  resolvePortalCapabilities,
} from "../shared/adminAccess";

describe("adminAccessForTenantRole", () => {
  it("maps Digilist building admins to full portal access", () => {
    expect(adminAccessForTenantRole("tenant_admin")).toBe("full");
    expect(adminAccessForTenantRole("owner")).toBe("full");
    expect(adminAccessForTenantRole("Admin")).toBe("full");
  });

  it("maps Digilist case handlers to operations access", () => {
    expect(adminAccessForTenantRole("saksbehandler")).toBe("operations");
    expect(adminAccessForTenantRole("staff")).toBe("operations");
    expect(adminAccessForTenantRole("manager")).toBe("operations");
  });

  it("returns null for bookers and unknown roles", () => {
    expect(adminAccessForTenantRole("member")).toBeNull();
    expect(adminAccessForTenantRole("support")).toBeNull();
    expect(adminAccessForTenantRole("")).toBeNull();
  });
});

describe("resolvePortalCapabilities", () => {
  it("seeds from Digilist roles when nothing is assigned on Brukere", () => {
    expect(
      resolvePortalCapabilities({
        email: "a@example.invalid",
        isMember: true,
        allowlisted: true,
        tenantRole: "tenant_admin",
      }),
    ).toMatchObject({
      isAdmin: true,
      adminAccess: "full",
      portalRole: "full",
    });
  });

  it("lets Brukere override Digilist seeds without leaving the portal", () => {
    expect(
      resolvePortalCapabilities({
        email: "a@example.invalid",
        isMember: true,
        allowlisted: true,
        tenantRole: "support",
        assigned: "operations",
      }),
    ).toMatchObject({
      isAdmin: true,
      adminAccess: "operations",
      portalRole: "operations",
    });
    expect(
      resolvePortalCapabilities({
        email: "a@example.invalid",
        isMember: true,
        allowlisted: true,
        tenantRole: "tenant_admin",
        assigned: "member",
      }).isAdmin,
    ).toBe(false);
  });

  it("still requires allowlist and membership", () => {
    expect(
      resolvePortalCapabilities({
        email: "a@example.invalid",
        isMember: true,
        allowlisted: false,
        tenantRole: "tenant_admin",
        assigned: "full",
      }).isAdmin,
    ).toBe(false);
  });
});

describe("portal capability helpers", () => {
  it("requires full adminAccess for portal management", () => {
    expect(canManagePortal({ isAdmin: true, adminAccess: "full" })).toBe(true);
    expect(canManagePortal({ isAdmin: true, adminAccess: "operations" })).toBe(
      false,
    );
    expect(canManagePortal({ isAdmin: false, adminAccess: "full" })).toBe(
      false,
    );
  });

  it("treats any admin as operations-capable", () => {
    expect(canManageOperations({ isAdmin: true })).toBe(true);
    expect(canManageOperations({ isAdmin: false })).toBe(false);
  });
});
