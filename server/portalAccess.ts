import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppError } from "../shared/validation";

export type PortalAccessSource = "approve" | "admin" | "backfill";

/** Møterom-owned portal grants — Digilist membership alone does not open the portal. */
export class PortalAccessStore {
  db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL;
       CREATE TABLE IF NOT EXISTS portal_access (
         email TEXT PRIMARY KEY,
         granted_at INTEGER NOT NULL,
         source TEXT NOT NULL
       );`,
    );
  }

  has(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return false;
    const row = this.db
      .prepare(`SELECT 1 AS ok FROM portal_access WHERE email = ?`)
      .get(normalized) as { ok?: number } | undefined;
    return Boolean(row?.ok);
  }

  grant(email: string, source: PortalAccessSource): void {
    const normalized = email.trim().toLowerCase();
    if (!normalized)
      throw new AppError(400, "Mangler e-postadresse.", "email_required");
    if (source === "backfill" && this.has(normalized)) return;
    this.db
      .prepare(
        `INSERT INTO portal_access (email, granted_at, source)
         VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           granted_at = excluded.granted_at,
           source = excluded.source`,
      )
      .run(normalized, Date.now(), source);
  }

  revoke(email: string): void {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    this.db
      .prepare(`DELETE FROM portal_access WHERE email = ?`)
      .run(normalized);
  }

  list(): string[] {
    return (
      this.db
        .prepare(`SELECT email FROM portal_access ORDER BY email`)
        .all() as {
        email: string;
      }[]
    ).map((row) => row.email);
  }
}

/** Live portal entry requires Digilist building membership plus a Møterom grant. */
export function isPortalMember(input: {
  digilistMember: boolean;
  allowlisted: boolean;
  granted: boolean;
  demo?: boolean;
}): boolean {
  if (!input.digilistMember) return false;
  if (input.demo) return true;
  return input.allowlisted || input.granted;
}
