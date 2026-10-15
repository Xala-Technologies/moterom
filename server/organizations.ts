import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  MembershipRequest,
  MembershipStatus,
  OrgAuditEvent,
  Organization,
  OrganizationMembership,
  OrganizationRelation,
  RegistrySource,
  RegistryStatus,
} from "../shared/types";
import { AppError } from "../shared/validation";
import { isValidOrgNumber, normalizeOrgNumber } from "./orgNumber";
import type { BrregLookupResult } from "./brreg";

function mapOrg(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    organizationNumber: String(row.organization_number),
    name: String(row.name),
    isInternalTenant: Boolean(row.is_internal_tenant),
    registryStatus: row.registry_status as RegistryStatus,
    registrySource: row.registry_source as RegistrySource,
    registryCheckedAt:
      row.registry_checked_at == null ? null : Number(row.registry_checked_at),
    manualIdealEligible: Boolean(row.manual_ideal_eligible),
    registrySnapshot: row.registry_snapshot
      ? String(row.registry_snapshot)
      : undefined,
    createdAt: Number(row.created),
    updatedAt: Number(row.updated),
  };
}

function mapMembership(row: Record<string, unknown>): OrganizationMembership {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as "representative" | "org_admin",
    status: row.status as MembershipStatus,
    createdAt: Number(row.created),
    updatedAt: Number(row.updated),
  };
}

function mapRelation(row: Record<string, unknown>): OrganizationRelation {
  return {
    id: String(row.id),
    childOrganizationId: String(row.child_organization_id),
    parentOrganizationId: String(row.parent_organization_id),
    kind: "member_of",
    status: row.status as MembershipStatus,
    createdAt: Number(row.created),
    updatedAt: Number(row.updated),
  };
}

function mapRequest(row: Record<string, unknown>): MembershipRequest {
  return {
    id: String(row.id),
    kind: row.kind as MembershipRequest["kind"],
    organizationId: row.organization_id
      ? String(row.organization_id)
      : undefined,
    parentOrganizationId: row.parent_organization_id
      ? String(row.parent_organization_id)
      : undefined,
    childOrganizationId: row.child_organization_id
      ? String(row.child_organization_id)
      : undefined,
    userId: row.user_id ? String(row.user_id) : undefined,
    email: String(row.email),
    name: String(row.name),
    status: row.status as MembershipStatus,
    note: String(row.note || ""),
    createdAt: Number(row.created),
    updatedAt: Number(row.updated),
  };
}

export class OrganizationStore {
  db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL;
       CREATE TABLE IF NOT EXISTS organizations (
         id TEXT PRIMARY KEY,
         organization_number TEXT NOT NULL UNIQUE,
         name TEXT NOT NULL,
         is_internal_tenant INTEGER NOT NULL DEFAULT 0,
         registry_status TEXT NOT NULL,
         registry_source TEXT NOT NULL,
         registry_checked_at INTEGER,
         manual_ideal_eligible INTEGER NOT NULL DEFAULT 0,
         registry_snapshot TEXT,
         created INTEGER NOT NULL,
         updated INTEGER NOT NULL
       );
       CREATE TABLE IF NOT EXISTS organization_relations (
         id TEXT PRIMARY KEY,
         child_organization_id TEXT NOT NULL,
         parent_organization_id TEXT NOT NULL,
         kind TEXT NOT NULL,
         status TEXT NOT NULL,
         created INTEGER NOT NULL,
         updated INTEGER NOT NULL,
         UNIQUE (child_organization_id, parent_organization_id, kind)
       );
       CREATE TABLE IF NOT EXISTS organization_memberships (
         id TEXT PRIMARY KEY,
         organization_id TEXT NOT NULL,
         user_id TEXT NOT NULL,
         email TEXT NOT NULL,
         name TEXT NOT NULL,
         role TEXT NOT NULL,
         status TEXT NOT NULL,
         created INTEGER NOT NULL,
         updated INTEGER NOT NULL,
         UNIQUE (organization_id, user_id)
       );
       CREATE TABLE IF NOT EXISTS membership_requests (
         id TEXT PRIMARY KEY,
         kind TEXT NOT NULL,
         organization_id TEXT,
         parent_organization_id TEXT,
         child_organization_id TEXT,
         user_id TEXT,
         email TEXT NOT NULL,
         name TEXT NOT NULL,
         status TEXT NOT NULL,
         note TEXT NOT NULL DEFAULT '',
         created INTEGER NOT NULL,
         updated INTEGER NOT NULL
       );
       CREATE TABLE IF NOT EXISTS org_audit_events (
         id TEXT PRIMARY KEY,
         at INTEGER NOT NULL,
         actor_user_id TEXT NOT NULL,
         actor_email TEXT NOT NULL,
         action TEXT NOT NULL,
         entity_type TEXT NOT NULL,
         entity_id TEXT NOT NULL,
         detail TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS org_memberships_user
         ON organization_memberships (user_id, status);
       CREATE INDEX IF NOT EXISTS membership_requests_status
         ON membership_requests (status, created);`,
    );
    this.seedIfEmpty();
  }

  private seedIfEmpty() {
    const count = this.db
      .prepare(`SELECT COUNT(*) AS n FROM organizations`)
      .get() as { n: number };
    if (count.n > 0) return;
    const now = Date.now();
    const kfukId = "org-kfuk";
    const fnId = "org-frivillighet-norge";
    const memberId = "org-kfuk-member";
    const idealId = "org-demo-ideal";

    const insert = this.db.prepare(
      `INSERT INTO organizations
       (id, organization_number, name, is_internal_tenant, registry_status,
        registry_source, registry_checked_at, manual_ideal_eligible,
        registry_snapshot, created, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      kfukId,
      "970189009",
      "Norges KFUK-KFUM",
      1,
      "unchecked",
      "none",
      null,
      0,
      null,
      now,
      now,
    );
    insert.run(
      fnId,
      "912345602",
      "Frivillighet Norge",
      1,
      "unchecked",
      "none",
      null,
      0,
      null,
      now,
      now,
    );
    insert.run(
      memberId,
      "918720405",
      "KFUM-tilknyttet organisasjon",
      0,
      "unchecked",
      "none",
      null,
      0,
      null,
      now,
      now,
    );
    // Matches BRREG_MODE=fixture entry 971277882.
    insert.run(
      idealId,
      "971277882",
      "Demo Ideell Organisasjon",
      0,
      "verified",
      "demo_fixture",
      now,
      0,
      JSON.stringify({
        fixture: true,
        registrertIFrivillighetsregisteret: true,
      }),
      now,
      now,
    );

    this.db
      .prepare(
        `INSERT INTO organization_relations
         (id, child_organization_id, parent_organization_id, kind, status, created, updated)
         VALUES (?, ?, ?, 'member_of', 'approved', ?, ?)`,
      )
      .run(randomUUID(), memberId, kfukId, now, now);

    this.db
      .prepare(
        `INSERT INTO organization_memberships
         (id, organization_id, user_id, email, name, role, status, created, updated)
         VALUES (?, ?, ?, ?, ?, 'representative', 'approved', ?, ?)`,
      )
      .run(
        randomUUID(),
        kfukId,
        "demo-internal",
        "intern@example.invalid",
        "Intern bruker",
        now,
        now,
      );
  }

  audit(
    actor: { id: string; email: string },
    action: string,
    entityType: string,
    entityId: string,
    detail: string,
  ) {
    this.db
      .prepare(
        `INSERT INTO org_audit_events
         (id, at, actor_user_id, actor_email, action, entity_type, entity_id, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        Date.now(),
        actor.id,
        actor.email.trim().toLowerCase(),
        action,
        entityType,
        entityId,
        detail,
      );
  }

  listAudit(limit = 100): OrgAuditEvent[] {
    return (
      this.db
        .prepare(`SELECT * FROM org_audit_events ORDER BY at DESC LIMIT ?`)
        .all(limit) as Record<string, unknown>[]
    ).map((row) => ({
      id: String(row.id),
      at: Number(row.at),
      actorUserId: String(row.actor_user_id),
      actorEmail: String(row.actor_email),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      detail: String(row.detail),
    }));
  }

  listOrganizations(): Organization[] {
    return (
      this.db
        .prepare(`SELECT * FROM organizations ORDER BY name COLLATE NOCASE`)
        .all() as Record<string, unknown>[]
    ).map(mapOrg);
  }

  getOrganization(id: string): Organization | undefined {
    const row = this.db
      .prepare(`SELECT * FROM organizations WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapOrg(row) : undefined;
  }

  getByOrgNumber(organizationNumber: string): Organization | undefined {
    const row = this.db
      .prepare(`SELECT * FROM organizations WHERE organization_number = ?`)
      .get(normalizeOrgNumber(organizationNumber)) as
      Record<string, unknown> | undefined;
    return row ? mapOrg(row) : undefined;
  }

  /** Idempotent upsert from Brreg/fixture lookup. Never grants membership. */
  upsertFromRegistry(lookup: BrregLookupResult): Organization {
    const organizationNumber = normalizeOrgNumber(lookup.organizationNumber);
    if (!isValidOrgNumber(organizationNumber)) {
      throw new AppError(
        400,
        "Ugyldig organisasjonsnummer.",
        "invalid_organization_number",
      );
    }
    const existing = this.getByOrgNumber(organizationNumber);
    const now = Date.now();
    if (existing) {
      this.db
        .prepare(
          `UPDATE organizations SET
             name = ?,
             registry_status = ?,
             registry_source = ?,
             registry_checked_at = ?,
             registry_snapshot = ?,
             updated = ?
           WHERE id = ?`,
        )
        .run(
          lookup.name,
          lookup.registryStatus,
          lookup.registrySource,
          now,
          lookup.snapshot,
          now,
          existing.id,
        );
      return this.getOrganization(existing.id)!;
    }
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO organizations
         (id, organization_number, name, is_internal_tenant, registry_status,
          registry_source, registry_checked_at, manual_ideal_eligible,
          registry_snapshot, created, updated)
         VALUES (?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(
        id,
        organizationNumber,
        lookup.name,
        lookup.registryStatus,
        lookup.registrySource,
        now,
        lookup.snapshot,
        now,
        now,
      );
    return this.getOrganization(id)!;
  }

  setManualIdeal(
    organizationId: string,
    eligible: boolean,
    actor: { id: string; email: string },
  ): Organization {
    const org = this.getOrganization(organizationId);
    if (!org)
      throw new AppError(404, "Organisasjonen finnes ikke.", "org_not_found");
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE organizations SET manual_ideal_eligible = ?, updated = ? WHERE id = ?`,
      )
      .run(eligible ? 1 : 0, now, organizationId);
    this.audit(
      actor,
      eligible ? "manual_ideal_grant" : "manual_ideal_revoke",
      "organization",
      organizationId,
      `manualIdealEligible=${eligible}`,
    );
    return this.getOrganization(organizationId)!;
  }

  listRelations(): OrganizationRelation[] {
    return (
      this.db
        .prepare(`SELECT * FROM organization_relations ORDER BY created DESC`)
        .all() as Record<string, unknown>[]
    ).map(mapRelation);
  }

  listMemberships(organizationId?: string): OrganizationMembership[] {
    const rows = organizationId
      ? (this.db
          .prepare(
            `SELECT * FROM organization_memberships WHERE organization_id = ? ORDER BY created DESC`,
          )
          .all(organizationId) as Record<string, unknown>[])
      : (this.db
          .prepare(
            `SELECT * FROM organization_memberships ORDER BY created DESC`,
          )
          .all() as Record<string, unknown>[]);
    return rows.map(mapMembership);
  }

  approvedMembershipsForUser(userId: string): OrganizationMembership[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM organization_memberships
           WHERE user_id = ? AND status = 'approved'
           ORDER BY created ASC`,
        )
        .all(userId) as Record<string, unknown>[]
    ).map(mapMembership);
  }

  getApprovedMembership(
    userId: string,
    organizationId: string,
  ): OrganizationMembership | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM organization_memberships
         WHERE user_id = ? AND organization_id = ? AND status = 'approved'`,
      )
      .get(userId, organizationId) as Record<string, unknown> | undefined;
    return row ? mapMembership(row) : undefined;
  }

  upsertMembership(input: {
    organizationId: string;
    userId: string;
    email: string;
    name: string;
    role?: "representative" | "org_admin";
    status: MembershipStatus;
  }): OrganizationMembership {
    const existing = this.db
      .prepare(
        `SELECT * FROM organization_memberships
         WHERE organization_id = ? AND user_id = ?`,
      )
      .get(input.organizationId, input.userId) as
      Record<string, unknown> | undefined;
    const now = Date.now();
    if (existing) {
      const existingId = String(existing.id);
      const role =
        input.role || (String(existing.role) as "representative" | "org_admin");
      this.db
        .prepare(
          `UPDATE organization_memberships SET
             email = ?, name = ?, role = ?, status = ?, updated = ?
           WHERE id = ?`,
        )
        .run(
          input.email.trim().toLowerCase(),
          input.name.trim(),
          role,
          input.status,
          now,
          existingId,
        );
      return mapMembership(
        this.db
          .prepare(`SELECT * FROM organization_memberships WHERE id = ?`)
          .get(existingId) as Record<string, unknown>,
      );
    }
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO organization_memberships
         (id, organization_id, user_id, email, name, role, status, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.organizationId,
        input.userId,
        input.email.trim().toLowerCase(),
        input.name.trim(),
        input.role || "representative",
        input.status,
        now,
        now,
      );
    return this.listMemberships().find((m) => m.id === id)!;
  }

  setMembershipStatus(
    membershipId: string,
    status: MembershipStatus,
    actor: { id: string; email: string },
  ): OrganizationMembership {
    const row = this.db
      .prepare(`SELECT * FROM organization_memberships WHERE id = ?`)
      .get(membershipId) as Record<string, unknown> | undefined;
    if (!row)
      throw new AppError(
        404,
        "Medlemskapet finnes ikke.",
        "membership_not_found",
      );
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE organization_memberships SET status = ?, updated = ? WHERE id = ?`,
      )
      .run(status, now, membershipId);
    this.audit(
      actor,
      `membership_${status}`,
      "membership",
      membershipId,
      status,
    );
    return mapMembership(
      this.db
        .prepare(`SELECT * FROM organization_memberships WHERE id = ?`)
        .get(membershipId) as Record<string, unknown>,
    );
  }

  listRequests(status?: MembershipStatus): MembershipRequest[] {
    const rows = status
      ? (this.db
          .prepare(
            `SELECT * FROM membership_requests WHERE status = ? ORDER BY created DESC`,
          )
          .all(status) as Record<string, unknown>[])
      : (this.db
          .prepare(`SELECT * FROM membership_requests ORDER BY created DESC`)
          .all() as Record<string, unknown>[]);
    return rows.map(mapRequest);
  }

  createRepresentRequest(input: {
    organizationId: string;
    userId: string;
    email: string;
    name: string;
    note?: string;
  }): MembershipRequest {
    const email = input.email.trim().toLowerCase();
    const pending = this.db
      .prepare(
        `SELECT * FROM membership_requests
         WHERE kind = 'represent_organization'
           AND organization_id = ?
           AND email = ?
           AND status = 'pending'
         LIMIT 1`,
      )
      .get(input.organizationId, email) as Record<string, unknown> | undefined;
    if (pending) return mapRequest(pending);

    // Also ensure a pending membership row exists (no price until approved).
    this.upsertMembership({
      organizationId: input.organizationId,
      userId: input.userId,
      email,
      name: input.name,
      status: "pending",
    });

    const now = Date.now();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO membership_requests
         (id, kind, organization_id, user_id, email, name, status, note, created, updated)
         VALUES (?, 'represent_organization', ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .run(
        id,
        input.organizationId,
        input.userId,
        email,
        input.name.trim(),
        input.note || "",
        now,
        now,
      );
    return mapRequest(
      this.db
        .prepare(`SELECT * FROM membership_requests WHERE id = ?`)
        .get(id) as Record<string, unknown>,
    );
  }

  setRequestStatus(
    requestId: string,
    status: MembershipStatus,
    actor: { id: string; email: string },
  ): MembershipRequest {
    const row = this.db
      .prepare(`SELECT * FROM membership_requests WHERE id = ?`)
      .get(requestId) as Record<string, unknown> | undefined;
    if (!row)
      throw new AppError(
        404,
        "Forespørselen finnes ikke.",
        "request_not_found",
      );
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE membership_requests SET status = ?, updated = ? WHERE id = ?`,
      )
      .run(status, now, requestId);
    const req = mapRequest({ ...row, status, updated: now });
    if (
      req.kind === "represent_organization" &&
      req.organizationId &&
      req.userId
    ) {
      this.upsertMembership({
        organizationId: req.organizationId,
        userId: req.userId,
        email: req.email,
        name: req.name,
        status,
      });
    }
    this.audit(
      actor,
      `request_${status}`,
      "membership_request",
      requestId,
      status,
    );
    return req;
  }

  approvedMemberOfInternal(organizationId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT r.id FROM organization_relations r
         JOIN organizations p ON p.id = r.parent_organization_id
         WHERE r.child_organization_id = ?
           AND r.kind = 'member_of'
           AND r.status = 'approved'
           AND p.is_internal_tenant = 1
         LIMIT 1`,
      )
      .get(organizationId);
    return Boolean(row);
  }
}
