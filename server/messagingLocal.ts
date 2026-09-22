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
       );`,
    );
  }

  private mapConversation(row: Record<string, unknown>): ConversationSummary {
    return {
      id: String(row.id),
      kind: "support",
      roomName: "",
      subject: SUPPORT_SUBJECT,
      preview: String(row.preview || ""),
      updatedAt: Number(row.updated),
      unread: Number(row.unread || 0),
      customerName: String(row.customer_name),
      customerId: String(row.customer_id),
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

  private getConversation(id: string): ConversationSummary | null {
    const row = this.db
      .prepare(
        `SELECT id, customer_id, customer_name, preview, updated, unread
         FROM support_conversations WHERE id = ?`,
      )
      .get(id);
    return row ? this.mapConversation(row as Record<string, unknown>) : null;
  }

  private getByCustomer(customerId: string): ConversationSummary | null {
    const row = this.db
      .prepare(
        `SELECT id, customer_id, customer_name, preview, updated, unread
         FROM support_conversations WHERE customer_id = ?`,
      )
      .get(customerId);
    return row ? this.mapConversation(row as Record<string, unknown>) : null;
  }

  private saveConversation(conversation: ConversationSummary): void {
    this.db
      .prepare(
        `INSERT INTO support_conversations
         (id, customer_id, customer_name, preview, updated, unread)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           customer_name = excluded.customer_name,
           preview = excluded.preview,
           updated = excluded.updated,
           unread = excluded.unread`,
      )
      .run(
        conversation.id,
        conversation.customerId || "",
        conversation.customerName,
        conversation.preview,
        conversation.updatedAt,
        conversation.unread,
      );
  }

  private thread(conversation: ConversationSummary): ConversationThread {
    return { conversation, messages: this.messagesFor(conversation.id) };
  }

  inbox(user: User): ConversationSummary[] {
    if (user.isAdmin) {
      return this.db
        .prepare(
          `SELECT id, customer_id, customer_name, preview, updated, unread
           FROM support_conversations
           ORDER BY updated DESC`,
        )
        .all()
        .map((row) => this.mapConversation(row as Record<string, unknown>));
    }
    const mine = this.getByCustomer(user.id);
    return mine ? [mine] : [];
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
    let conversation = this.getByCustomer(user.id);
    if (!conversation) {
      conversation = {
        id: `${SUPPORT_PREFIX}${randomUUID()}`,
        kind: "support",
        roomName: "",
        subject: SUPPORT_SUBJECT,
        preview: "",
        updatedAt: Date.now(),
        unread: 0,
        customerName: user.name,
        customerId: user.id,
      };
      this.saveConversation(conversation);
    } else if (conversation.customerName !== user.name) {
      conversation = { ...conversation, customerName: user.name };
      this.saveConversation(conversation);
    }
    if (content?.trim()) {
      return this.appendMessage(
        conversation,
        content.trim(),
        user,
        clientMessageId,
      );
    }
    return this.thread(conversation);
  }

  conversationThread(id: string, user: User): ConversationThread {
    const conversation = this.getConversation(id);
    if (!conversation)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (!user.isAdmin && conversation.customerId !== user.id)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (user.isAdmin && conversation.unread > 0) {
      conversation.unread = 0;
      this.saveConversation(conversation);
    }
    return this.thread(conversation);
  }

  sendConversationMessage(
    id: string,
    content: string,
    user: User,
    clientMessageId?: string,
  ): ConversationThread {
    const thread = this.conversationThread(id, user);
    if (!thread.conversation)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    return this.appendMessage(
      thread.conversation,
      content,
      user,
      clientMessageId,
    );
  }

  deleteConversation(id: string): { success: true } {
    const conversation = this.getConversation(id);
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

  private appendMessage(
    conversation: ConversationSummary,
    content: string,
    user: User,
    clientMessageId?: string,
  ): ConversationThread {
    if (clientMessageId) {
      const replayed = this.messagesFor(conversation.id).find(
        (m) =>
          m.id === clientMessageId ||
          (m as Message & { clientMessageId?: string }).clientMessageId ===
            clientMessageId,
      );
      if (replayed) return this.thread(conversation);
    }
    const createdAt = Date.now();
    const message: Message & { clientMessageId?: string } = {
      id: clientMessageId || randomUUID(),
      conversationId: conversation.id,
      senderId: user.id,
      senderName: user.isAdmin ? "Administrator" : user.name,
      fromAdmin: user.isAdmin,
      content,
      createdAt,
      clientMessageId,
    };
    this.db
      .prepare(
        `INSERT INTO support_messages (id, conversation_id, created, data)
         VALUES (?, ?, ?, ?)`,
      )
      .run(message.id, conversation.id, createdAt, JSON.stringify(message));
    conversation.preview = content;
    conversation.updatedAt = createdAt;
    conversation.unread = user.isAdmin ? 0 : 1;
    this.saveConversation(conversation);
    return this.thread(conversation);
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
