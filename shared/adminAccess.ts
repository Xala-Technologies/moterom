import type { User } from "./types";

/**
 * Digilist tenant roles that seed a default portal capability when no
 * Møterom portal role has been assigned on Brukere yet.
 */
export const FULL_PORTAL_ADMIN_ROLES = new Set([
  "tenant_admin",
  "owner",
  "admin",
]);

/** Digilist roles that seed operations access when no portal role is set. */
export const OPERATIONS_ADMIN_ROLES = new Set([
  "saksbehandler",
  "manager",
  "staff",
]);

export const BUILDING_ADMIN_ROLES = new Set([
  ...FULL_PORTAL_ADMIN_ROLES,
  ...OPERATIONS_ADMIN_ROLES,
]);

export type AdminAccess = "full" | "operations";

/** Portal role assigned on Admin → Brukere (Møterom-owned). */
export type PortalRole = "member" | "operations" | "full";

export const PORTAL_ROLES = ["member", "operations", "full"] as const;

export function isBuildingAdminRole(role: string): boolean {
  return BUILDING_ADMIN_ROLES.has(role.trim().toLowerCase());
}

export function adminAccessForTenantRole(
  role: string | null | undefined,
): AdminAccess | null {
  const normalized = (role ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (FULL_PORTAL_ADMIN_ROLES.has(normalized)) return "full";
  if (OPERATIONS_ADMIN_ROLES.has(normalized)) return "operations";
  return null;
}

export function isPortalRole(value: string): value is PortalRole {
  return (PORTAL_ROLES as readonly string[]).includes(value);
}

/**
 * Resolve portal capabilities from an optional Brukere assignment, falling
 * back to the Digilist tenant role as a seed for allowlisted members.
 */
export function resolvePortalCapabilities(input: {
  email: string;
  isMember: boolean;
  allowlisted: boolean;
  tenantRole?: string | null;
  assigned?: PortalRole | null;
}): Pick<User, "isAdmin" | "adminAccess" | "portalRole"> {
  const fromDigilist = adminAccessForTenantRole(input.tenantRole);
  const seeded: PortalRole =
    fromDigilist === "full"
      ? "full"
      : fromDigilist === "operations"
        ? "operations"
        : "member";
  const portalRole = input.assigned ?? seeded;
  const isAdmin =
    input.allowlisted && input.isMember && portalRole !== "member";
  return {
    isAdmin,
    portalRole,
    adminAccess: isAdmin
      ? portalRole === "full"
        ? "full"
        : "operations"
      : undefined,
  };
}

/** Rooms, membership, announcements, and portal settings. */
export function canManagePortal(
  user: Pick<User, "isAdmin" | "adminAccess"> | null | undefined,
): boolean {
  return Boolean(user?.isAdmin && user.adminAccess === "full");
}

/** Overview, calendar, bookings, messages, blocks, insights. */
export function canManageOperations(
  user: Pick<User, "isAdmin"> | null | undefined,
): boolean {
  return Boolean(user?.isAdmin);
}
