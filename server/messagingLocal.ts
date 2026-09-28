import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  Announcement,
  ConversationSummary,
  ConversationThread,
  Message,
  User,
} from "../shared/types";
import { annotateMessagesWithReadReceipts } from "../shared/messageReadReceipts";
import { AppError } from "../shared/validation";

const SUPPORT_PREFIX = "sup_";
export const SUPPORT_SUBJECT = "Generell henvendelse";

export function isSupportConversationId(id: string): boolean {
  return id.startsWith(SUPPORT_PREFIX);
}

export class MessagingLocalStore {
  db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL;
       CREATE TABLE IF NOT EXISTS support_conversations (
         id TEXT PRIMARY KEY,
         customer_id TEXT NOT NULL,
         customer_name TEXT NOT NULL,
         preview TEXT NOT NULL DEFAULT '',
         updated INTEGER NOT NULL,
         unread INTEGER NOT NULL DEFAULT 0
       );
       CREATE UNIQUE INDEX IF NOT EXISTS support_conversations_customer
         ON support_conversations (customer_id);
       CREATE TABLE IF NOT EXISTS support_messages (
         id TEXT PRIMARY KEY,
         conversation_id TEXT NOT NULL,
         created INTEGER NOT NULL,
         data TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS support_messages_conversation
         ON support_messages (conversation_id, created);
       CREATE TABLE IF NOT EXISTS announcements (
         id TEXT PRIMARY KEY,
         title TEXT NOT NULL,
         body TEXT NOT NULL,
         created INTEGER NOT NULL,
         created_by TEXT NOT NULL,
         active INTEGER NOT NULL DEFAULT 1
       );
       CREATE INDEX IF NOT EXISTS announcements_active_created
         ON announcements (active, created DESC);
       CREATE TABLE IF NOT EXISTS announcement_dismissals (
         announcement_id TEXT NOT NULL,
         user_id TEXT NOT NULL,
         dismissed INTEGER NOT NULL,
         PRIMARY KEY (announcement_id, user_id)
       );
       CREATE TABLE IF NOT EXISTS hidden_conversations (
         id TEXT PRIMARY KEY,
         hidden INTEGER NOT NULL
       );
       CREATE TABLE IF NOT EXISTS admin_unread_flags (
         id TEXT PRIMARY KEY,
         unread INTEGER NOT NULL
       );`,
    );
    // Existing installs created support_conversations before customer_unread.
    try {
      this.db.exec(
        `ALTER TABLE support_conversations
         ADD COLUMN customer_unread INTEGER NOT NULL DEFAULT 0`,
      );
    } catch {
      /* column already present */
    }
  }

  /** Row storage: `unread` = admin inbox, `customer_unread` = customer inbox. */
  private mapStored(row: Record<string, unknown>): {
    id: string;
    customerId: string;
    customerName: string;
    preview: string;
    updatedAt: number;
    adminUnread: number;
    customerUnread: number;
  } {
    return {
      id: String(row.id),
      customerId: String(row.customer_id),
      customerName: String(row.customer_name),
      preview: String(row.preview || ""),
      updatedAt: Number(row.updated),
      adminUnread: Number(row.unread || 0),
      customerUnread: Number(row.customer_unread || 0),
    };
  }

  private presentConversation(
    stored: ReturnType<MessagingLocalStore["mapStored"]>,
    forAdmin: boolean,
  ): ConversationSummary {
    return {
      id: stored.id,
      kind: "support",
      roomName: "",
      subject: SUPPORT_SUBJECT,
      preview: stored.preview,
      updatedAt: stored.updatedAt,
      unread: forAdmin ? stored.adminUnread : stored.customerUnread,
      customerName: stored.customerName,
      customerId: stored.customerId,
      canAttachImages: true,
    };
  }

  private messagesFor(conversationId: string): Message[] {
    return this.db
      .prepare(
        `SELECT data FROM support_messages
         WHERE conversation_id = ?
         ORDER BY created ASC`,
      )
      .all(conversationId)
      .map((row) => JSON.parse(String(row.data)) as Message);
  }

  private getStored(id: string) {
    const row = this.db
      .prepare(
        `SELECT id, customer_id, customer_name, preview, updated, unread,
                customer_unread
         FROM support_conversations WHERE id = ?`,
      )
      .get(id);
    return row ? this.mapStored(row as Record<string, unknown>) : null;
  }

  private getStoredByCustomer(customerId: string) {
    const row = this.db
      .prepare(
        `SELECT id, customer_id, customer_name, preview, updated, unread,
                customer_unread
         FROM support_conversations WHERE customer_id = ?`,
      )
      .get(customerId);
    return row ? this.mapStored(row as Record<string, unknown>) : null;
  }

  private saveStored(
    stored: ReturnType<MessagingLocalStore["mapStored"]>,
  ): void {
    this.db
      .prepare(
        `INSERT INTO support_conversations
         (id, customer_id, customer_name, preview, updated, unread, customer_unread)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           customer_name = excluded.customer_name,
           preview = excluded.preview,
           updated = excluded.updated,
           unread = excluded.unread,
           customer_unread = excluded.customer_unread`,
      )
      .run(
        stored.id,
        stored.customerId,
        stored.customerName,
        stored.preview,
        stored.updatedAt,
        stored.adminUnread,
        stored.customerUnread,
      );
  }

  private thread(
    stored: ReturnType<MessagingLocalStore["mapStored"]>,
    forAdmin: boolean,
  ): ConversationThread {
    const peerUnread = forAdmin ? stored.customerUnread : stored.adminUnread;
    return {
      conversation: this.presentConversation(stored, forAdmin),
      messages: annotateMessagesWithReadReceipts(
        this.messagesFor(stored.id),
        peerUnread,
        forAdmin,
      ),
    };
  }

  inbox(user: User): ConversationSummary[] {
    if (user.isAdmin) {
      return this.db
        .prepare(
          `SELECT id, customer_id, customer_name, preview, updated, unread,
                  customer_unread
           FROM support_conversations
           ORDER BY updated DESC`,
        )
        .all()
        .map((row) =>
          this.presentConversation(
            this.mapStored(row as Record<string, unknown>),
            true,
          ),
        );
    }
    const mine = this.getStoredByCustomer(user.id);
    return mine ? [this.presentConversation(mine, false)] : [];
  }

  openSupport(
    user: User,
    content?: string,
    clientMessageId?: string,
  ): ConversationThread {
    if (user.isAdmin)
      throw new AppError(
        400,
        "Administratorer svarer i eksisterende samtaler.",
        "support_customer_only",
      );
    let stored = this.getStoredByCustomer(user.id);
    if (!stored) {
      stored = {
        id: `${SUPPORT_PREFIX}${randomUUID()}`,
        customerId: user.id,
        customerName: user.name,
        preview: "",
        updatedAt: Date.now(),
        adminUnread: 0,
        customerUnread: 0,
      };
      this.saveStored(stored);
    } else if (stored.customerName !== user.name) {
      stored = { ...stored, customerName: user.name };
      this.saveStored(stored);
    }
    if (content?.trim()) {
      return this.appendMessage(
        stored.id,
        content.trim(),
        user,
        clientMessageId,
      );
    }
    return this.thread(stored, false);
  }

  conversationThread(id: string, user: User): ConversationThread {
    const stored = this.getStored(id);
    if (!stored)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (!user.isAdmin && stored.customerId !== user.id)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (user.isAdmin && stored.adminUnread > 0) {
      stored.adminUnread = 0;
      this.saveStored(stored);
    } else if (!user.isAdmin && stored.customerUnread > 0) {
      stored.customerUnread = 0;
      this.saveStored(stored);
    }
    return this.thread(stored, user.isAdmin);
  }

  sendConversationMessage(
    id: string,
    content: string,
    user: User,
    clientMessageId?: string,
    imageUrl?: string,
  ): ConversationThread {
    // Ensure access + mark the viewer's inbox read before appending.
    this.conversationThread(id, user);
    return this.appendMessage(id, content, user, clientMessageId, imageUrl);
  }

  deleteConversation(id: string): { success: true } {
    const conversation = this.getStored(id);
    if (!conversation)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    this.db
      .prepare(`DELETE FROM support_messages WHERE conversation_id = ?`)
      .run(id);
    this.db.prepare(`DELETE FROM support_conversations WHERE id = ?`).run(id);
    return { success: true };
  }

  hideConversation(id: string): { success: true } {
    this.db
      .prepare(
        `INSERT INTO hidden_conversations (id, hidden)
         VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET hidden = excluded.hidden`,
      )
      .run(id, Date.now());
    return { success: true };
  }

  isHidden(id: string): boolean {
    const row = this.db
      .prepare(`SELECT id FROM hidden_conversations WHERE id = ?`)
      .get(id);
    return Boolean(row);
  }

  /** Digilist booking threads: admin-forced unread when Digilist has no mark-unread API. */
  setAdminUnreadFlag(id: string, unread: boolean): void {
    this.db
      .prepare(
        `INSERT INTO admin_unread_flags (id, unread)
         VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET unread = excluded.unread`,
      )
      .run(id, unread ? 1 : 0);
  }

  clearAdminUnreadFlag(id: string): void {
    this.db.prepare(`DELETE FROM admin_unread_flags WHERE id = ?`).run(id);
  }

  applyAdminUnreadFlag(row: ConversationSummary): ConversationSummary {
    const flag = this.db
      .prepare(`SELECT unread FROM admin_unread_flags WHERE id = ?`)
      .get(row.id) as { unread?: number } | undefined;
    if (!flag) return row;
    return {
      ...row,
      unread: flag.unread ? Math.max(1, Number(row.unread) || 0) : 0,
    };
  }

  /** Support threads: set the viewer's unread counter (admin or customer). */
  setUnread(id: string, user: User, unread: boolean): ConversationSummary {
    const stored = this.getStored(id);
    if (!stored)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (!user.isAdmin && stored.customerId !== user.id)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (user.isAdmin)
      stored.adminUnread = unread ? Math.max(1, stored.adminUnread) : 0;
    else
      stored.customerUnread = unread ? Math.max(1, stored.customerUnread) : 0;
    this.saveStored(stored);
    this.clearAdminUnreadFlag(id);
    return this.presentConversation(stored, user.isAdmin);
  }

  private appendMessage(
    conversationId: string,
    content: string,
    user: User,
    clientMessageId?: string,
    imageUrl?: string,
  ): ConversationThread {
    const stored = this.getStored(conversationId);
    if (!stored)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (clientMessageId) {
      const replayed = this.messagesFor(stored.id).find(
        (m) =>
          m.id === clientMessageId ||
          (m as Message & { clientMessageId?: string }).clientMessageId ===
            clientMessageId,
      );
      if (replayed) return this.thread(stored, user.isAdmin);
    }
    const text = content.trim();
    if (!text && !imageUrl)
      throw new AppError(
        400,
        "Skriv en melding eller legg ved et bilde.",
        "validation_failed",
      );
    const createdAt = Date.now();
    const message: Message & { clientMessageId?: string } = {
      id: clientMessageId || randomUUID(),
      conversationId: stored.id,
      senderId: user.id,
      senderName: user.isAdmin ? "Administrator" : user.name,
      fromAdmin: user.isAdmin,
      content: text,
      ...(imageUrl ? { imageUrl } : {}),
      createdAt,
      clientMessageId,
    };
    this.db
      .prepare(
        `INSERT INTO support_messages (id, conversation_id, created, data)
         VALUES (?, ?, ?, ?)`,
      )
      .run(message.id, stored.id, createdAt, JSON.stringify(message));
    stored.preview = text || "Bilde";
    stored.updatedAt = createdAt;
    // Counterparty inbox: admin replies bump the customer badge; customer
    // messages bump the admin badge.
    if (user.isAdmin) stored.customerUnread += 1;
    else stored.adminUnread += 1;
    this.saveStored(stored);
    return this.thread(stored, user.isAdmin);
  }

  listAnnouncements(): Announcement[] {
    return this.db
      .prepare(
        `SELECT id, title, body, created, created_by, active
         FROM announcements
         ORDER BY created DESC
         LIMIT 50`,
      )
      .all()
      .map((row) => this.mapAnnouncement(row as Record<string, unknown>));
  }

  createAnnouncement(
    input: { title: string; body: string },
    user: User,
  ): Announcement {
    const now = Date.now();
    this.db
      .prepare(`UPDATE announcements SET active = 0 WHERE active = 1`)
      .run();
    const row: Announcement = {
      id: randomUUID(),
      title: input.title,
      body: input.body,
      createdAt: now,
      createdBy: user.id,
      active: true,
    };
    this.db
      .prepare(
        `INSERT INTO announcements (id, title, body, created, created_by, active)
         VALUES (?, ?, ?, ?, ?, 1)`,
      )
      .run(row.id, row.title, row.body, row.createdAt, row.createdBy);
    return row;
  }

  deactivateAnnouncement(id: string): Announcement {
    const existing = this.getAnnouncement(id);
    this.db.prepare(`UPDATE announcements SET active = 0 WHERE id = ?`).run(id);
    return { ...existing, active: false };
  }

  activeForUser(user: User): Announcement | null {
    if (user.isAdmin) return null;
    const row = this.db
      .prepare(
        `SELECT a.id, a.title, a.body, a.created, a.created_by, a.active
         FROM announcements a
         WHERE a.active = 1
           AND NOT EXISTS (
             SELECT 1 FROM announcement_dismissals d
             WHERE d.announcement_id = a.id AND d.user_id = ?
           )
         ORDER BY a.created DESC
         LIMIT 1`,
      )
      .get(user.id);
    return row ? this.mapAnnouncement(row as Record<string, unknown>) : null;
  }

  dismissAnnouncement(id: string, user: User): { success: true } {
    const announcement = this.getAnnouncement(id);
    if (!announcement.active)
      throw new AppError(
        404,
        "Kunngjøringen er ikke aktiv.",
        "announcement_inactive",
      );
    this.db
      .prepare(
        `INSERT INTO announcement_dismissals (announcement_id, user_id, dismissed)
         VALUES (?, ?, ?)
         ON CONFLICT(announcement_id, user_id) DO UPDATE SET dismissed = excluded.dismissed`,
      )
      .run(id, user.id, Date.now());
    return { success: true };
  }

  private getAnnouncement(id: string): Announcement {
    const row = this.db
      .prepare(
        `SELECT id, title, body, created, created_by, active
         FROM announcements WHERE id = ?`,
      )
      .get(id);
    if (!row)
      throw new AppError(
        404,
        "Kunngjøringen ble ikke funnet.",
        "announcement_not_found",
      );
    return this.mapAnnouncement(row as Record<string, unknown>);
  }

  private mapAnnouncement(row: Record<string, unknown>): Announcement {
    return {
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      createdAt: Number(row.created),
      createdBy: String(row.created_by),
      active: Boolean(Number(row.active)),
    };
  }
}
