import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AccessRequest, AccessRequestStatus } from "../shared/types";
import { AppError } from "../shared/validation";

export class AccessRequestStore {
  db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL;
       CREATE TABLE IF NOT EXISTS access_requests (
         id TEXT PRIMARY KEY,
         created INTEGER NOT NULL,
         updated INTEGER NOT NULL,
         name TEXT NOT NULL,
         email TEXT NOT NULL,
         message TEXT NOT NULL,
         company TEXT NOT NULL DEFAULT '',
         user_id TEXT,
         status TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS access_requests_email_status
         ON access_requests (email, status);
       CREATE INDEX IF NOT EXISTS access_requests_status_created
         ON access_requests (status, created);`,
    );
    const columns = this.db
      .prepare(`PRAGMA table_info(access_requests)`)
      .all() as { name: string }[];
    if (!columns.some((column) => column.name === "company")) {
      this.db.exec(
        `ALTER TABLE access_requests ADD COLUMN company TEXT NOT NULL DEFAULT ''`,
      );
    }
  }

  list(): AccessRequest[] {
    return this.db
      .prepare(
        `SELECT id, created, updated, name, email, company, user_id, status
         FROM access_requests
         ORDER BY created DESC`,
      )
      .all()
      .map((row) => this.map(row));
  }

  create(input: {
    name: string;
    email: string;
    company: string;
    userId?: string;
  }): AccessRequest {
    const email = input.email.trim().toLowerCase();
    const company = input.company.trim();
    const pending = this.db
      .prepare(
        `SELECT id, created, updated, name, email, company, user_id, status
         FROM access_requests
         WHERE email = ? AND status = 'pending'
         LIMIT 1`,
      )
      .get(email);
    if (pending) {
      const existing = this.map(pending);
      if (existing.company === company) return existing;
      const updated = Date.now();
      this.db
        .prepare(
          `UPDATE access_requests SET company = ?, updated = ? WHERE id = ?`,
        )
        .run(company, updated, existing.id);
      return { ...existing, company, updatedAt: updated };
    }

    const now = Date.now();
    const row: AccessRequest = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      name: input.name.trim(),
      email,
      company,
      userId: input.userId,
      status: "pending",
    };
    this.db
      .prepare(
        `INSERT INTO access_requests
         (id, created, updated, name, email, message, company, user_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.createdAt,
        row.updatedAt,
        row.name,
        row.email,
        "",
        row.company,
        row.userId ?? null,
        row.status,
      );
    return row;
  }

  get(id: string): AccessRequest {
    const existing = this.db
      .prepare(
        `SELECT id, created, updated, name, email, company, user_id, status
         FROM access_requests WHERE id = ?`,
      )
      .get(id);
    if (!existing)
      throw new AppError(
        404,
        "Forespørselen ble ikke funnet.",
        "access_request_not_found",
      );
    return this.map(existing);
  }

  updateStatus(id: string, status: AccessRequestStatus): AccessRequest {
    const existing = this.get(id);
    const updated = Date.now();
    this.db
      .prepare(
        `UPDATE access_requests SET status = ?, updated = ? WHERE id = ?`,
      )
      .run(status, updated, id);
    return { ...existing, status, updatedAt: updated };
  }

  remove(id: string): void {
    this.get(id);
    this.db.prepare(`DELETE FROM access_requests WHERE id = ?`).run(id);
  }

  /** Latest non-empty firmanavn for each email. Does not change membership. */
  companyByEmail(): Map<string, string> {
    const rows = this.db
      .prepare(
        `SELECT email, company FROM access_requests
         WHERE company != ''
         ORDER BY updated DESC, rowid DESC`,
      )
      .all() as { email: string; company: string }[];
    const companies = new Map<string, string>();
    for (const row of rows) {
      const email = String(row.email).trim().toLowerCase();
      const company = String(row.company).trim();
      if (!email || !company || companies.has(email)) continue;
      companies.set(email, company);
    }
    return companies;
  }

  /** True when this email has an admin-approved access request. */
  hasApproved(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return false;
    const row = this.db
      .prepare(
        `SELECT id FROM access_requests
         WHERE email = ? AND status = 'approved'
         LIMIT 1`,
      )
      .get(normalized);
    return Boolean(row);
  }

  private map(row: Record<string, unknown>): AccessRequest {
    return {
      id: String(row.id),
      createdAt: Number(row.created),
      updatedAt: Number(row.updated),
      name: String(row.name),
      email: String(row.email),
      company: row.company ? String(row.company) : "",
      userId: row.user_id ? String(row.user_id) : undefined,
      status: row.status as AccessRequestStatus,
    };
  }
}
