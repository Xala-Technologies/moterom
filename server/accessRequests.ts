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
         user_id TEXT,
         status TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS access_requests_email_status
         ON access_requests (email, status);
       CREATE INDEX IF NOT EXISTS access_requests_status_created
         ON access_requests (status, created);`,
    );
  }

  list(): AccessRequest[] {
    return this.db
      .prepare(
        `SELECT id, created, updated, name, email, message, user_id, status
         FROM access_requests
         ORDER BY created DESC`,
      )
      .all()
      .map((row) => this.map(row));
  }

  create(input: {
    name: string;
    email: string;
    message: string;
    userId?: string;
  }): AccessRequest {
    const email = input.email.trim().toLowerCase();
    const pending = this.db
      .prepare(
        `SELECT id, created, updated, name, email, message, user_id, status
         FROM access_requests
         WHERE email = ? AND status = 'pending'
         LIMIT 1`,
      )
      .get(email);
    if (pending) return this.map(pending);

    const now = Date.now();
    const row: AccessRequest = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      name: input.name.trim(),
      email,
      message: input.message.trim(),
      userId: input.userId,
      status: "pending",
    };
    this.db
      .prepare(
        `INSERT INTO access_requests
         (id, created, updated, name, email, message, user_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.createdAt,
        row.updatedAt,
        row.name,
        row.email,
        row.message,
        row.userId ?? null,
        row.status,
      );
    return row;
  }

  updateStatus(id: string, status: AccessRequestStatus): AccessRequest {
    const existing = this.db
      .prepare(
        `SELECT id, created, updated, name, email, message, user_id, status
         FROM access_requests WHERE id = ?`,
      )
      .get(id);
    if (!existing)
      throw new AppError(
        404,
        "Forespørselen ble ikke funnet.",
        "access_request_not_found",
      );
    const updated = Date.now();
    this.db
      .prepare(
        `UPDATE access_requests SET status = ?, updated = ? WHERE id = ?`,
      )
      .run(status, updated, id);
    return this.map({ ...existing, status, updated });
  }

  private map(row: Record<string, unknown>): AccessRequest {
    return {
      id: String(row.id),
      createdAt: Number(row.created),
      updatedAt: Number(row.updated),
      name: String(row.name),
      email: String(row.email),
      message: String(row.message),
      userId: row.user_id ? String(row.user_id) : undefined,
      status: row.status as AccessRequestStatus,
    };
  }
}
