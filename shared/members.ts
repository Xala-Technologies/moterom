import type { TenantMember } from "./types";

/** Isolation-test identities, not people who use the building. */
export const DIGILIST_FIXTURE_EMAIL = /@digilist\.dev$/i;

export const BUILDING_ADMIN_ROLES = new Set([
  "tenant_admin",
  "saksbehandler",
  "owner",
  "admin",
  "manager",
  "staff",
]);

export function isBuildingAdminRole(role: string): boolean {
  return BUILDING_ADMIN_ROLES.has(role.trim().toLowerCase());
}

function memberRank(member: TenantMember): number {
  return (
    (member.status === "active" ? 8 : 0) +
    (isBuildingAdminRole(member.role) ? 4 : 0) +
    (member.name && member.name !== member.email ? 1 : 0)
  );
}

/** One row per person for the building directory. Hides fixture accounts. */
export function presentBuildingMembers(
  members: TenantMember[],
): TenantMember[] {
  const byEmail = new Map<string, TenantMember>();
  for (const member of members) {
    const email = member.email.trim().toLowerCase();
    if (!email || DIGILIST_FIXTURE_EMAIL.test(email)) continue;
    const next: TenantMember = {
      ...member,
      email,
      name: member.name.trim() || email,
    };
    const current = byEmail.get(email);
    if (!current || memberRank(next) > memberRank(current))
      byEmail.set(email, next);
  }
  return [...byEmail.values()].sort((a, b) => {
    const roleDelta =
      Number(isBuildingAdminRole(a.role)) - Number(isBuildingAdminRole(b.role));
    if (roleDelta !== 0) return -roleDelta;
    return a.name.localeCompare(b.name, "nb");
  });
}
