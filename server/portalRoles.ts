import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { isPortalRole, type PortalRole } from "../shared/adminAccess";
import { AppError } from "../shared/validation";

/** Portal roles assigned on Admin → Brukere (not Digilist staff roles). */
export class PortalRoleStore {
  db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL;
       CREATE TABLE IF NOT EXISTS portal_roles (
         email TEXT PRIMARY KEY,
         role TEXT NOT NULL,
         updated INTEGER NOT NULL
       );`,
    );
  }

  get(email: string): PortalRole | null {
    const row = this.db
      .prepare(`SELECT role FROM portal_roles WHERE email = ?`)
      .get(email.trim().toLowerCase()) as { role?: string } | undefined;
    if (!row?.role || !isPortalRole(row.role)) return null;
    return row.role;
  }

  set(email: string, role: PortalRole): PortalRole {
    if (!isPortalRole(role))
      throw new AppError(400, "Ugyldig portalrolle.", "invalid_portal_role");
    const normalized = email.trim().toLowerCase();
    if (!normalized)
      throw new AppError(400, "Mangler e-postadresse.", "email_required");
    this.db
      .prepare(
        `INSERT INTO portal_roles (email, role, updated)
         VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET role = excluded.role, updated = excluded.updated`,
      )
      .run(normalized, role, Date.now());
    return role;
  }

  all(): Map<string, PortalRole> {
    const map = new Map<string, PortalRole>();
    for (const row of this.db
      .prepare(`SELECT email, role FROM portal_roles`)
      .all() as { email: string; role: string }[]) {
      if (isPortalRole(row.role)) map.set(row.email, row.role);
    }
    return map;
  }
}
