import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  AdminData,
  Availability,
  Block,
  Booking,
  BookingInput,
  ConversationSummary,
  ConversationThread,
  InsightsBlock,
  InsightsBooking,
  Message,
  Room,
  Search,
  User,
} from "../shared/types";
import { addDays, interval, overlaps, today } from "../shared/time";
import { AppError } from "../shared/validation";
import { translateMessage } from "../shared/i18n/messages";
import { DEFAULT_LOCALE, type Locale } from "../shared/i18n/locale";
import { enrichBookingConversation } from "./conversationContext";
export class DemoStore {
  db: DatabaseSync;
  constructor(
    path: string,
    private seedRooms: Room[],
    seed = true,
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS requests (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, booking TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, created INTEGER NOT NULL, data TEXT NOT NULL);",
    );
    for (const room of seedRooms)
      this.db
        .prepare("INSERT OR IGNORE INTO rooms VALUES (?, ?)")
        .run(room.id, JSON.stringify(room));
    if (seed && !this.db.prepare("SELECT id FROM bookings LIMIT 1").get()) {
      const date = addDays(today(), 1);
      const examples = [
        {
          room: 0,
          start: "10:00",
          end: "11:30",
          name: "Kari Nordmann",
          title: "Prosjektmøte",
        },
        {
          room: 2,
          start: "09:00",
          end: "12:00",
          name: "Ola Hansen",
          title: "Arbeidsøkt",
        },
        {
          room: 4,
          start: "13:00",
          end: "14:00",
          name: "Kari Nordmann",
          title: "Planlegging",
        },
      ];
      for (const [i, item] of examples.entries()) {
        const room = seedRooms[item.room];
        if (!room) continue;
        const b: Booking = {
          id: `example-${i}`,
          reference: `DEMO-100${i}`,
          roomId: room.id,
          roomName: room.name,
          userId: i === 0 ? "demo-customer" : "demo-other",
          name: item.name,
          email: "demo@example.invalid",
          ...interval({ date, start: item.start, end: item.end }),
          people: 6,
          title: item.title,
          notes: "",
          status: "confirmed",
          totalPrice: 0,
          currency: "NOK",
          paymentRequired: false,
          cancellationAllowed: true,
        };
        this.save("bookings", b);
      }
    }
  }
  private all<T>(
    table: "rooms" | "bookings" | "blocks" | "conversations",
  ): T[] {
    return this.db
      .prepare(`SELECT data FROM ${table}`)
      .all()
      .map((row) => JSON.parse(String(row.data)) as T);
  }
  private save(
    table: "rooms" | "bookings" | "blocks" | "conversations",
    value: { id: string },
  ) {
    this.db
      .prepare(
        `INSERT INTO ${table} VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(value.id, JSON.stringify(value));
  }
  private audit(user: User, action: string, entity: string) {
    this.db
      .prepare("INSERT INTO audit VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), user.id, action, entity, Date.now());
  }
  rooms() {
    return this.all<Room>("rooms").map((room) => {
      const seed = this.seedRooms.find((item) => item.id === room.id);
      return {
        ...room,
        image: room.image || seed?.image,
        imageKind: room.imageKind || seed?.imageKind,
        descriptionEn: room.descriptionEn || seed?.descriptionEn || "",
        capacityLabelEn:
          room.capacityLabelEn || seed?.capacityLabelEn || room.capacityLabel,
      };
    });
  }
  room(id: string) {
    const room = this.rooms().find((r) => r.id === id);
    if (!room)
      throw new AppError(404, "Rommet ble ikke funnet.", "room_not_found");
    return room;
  }
  availability(
    search: Search,
    locale: Locale = DEFAULT_LOCALE,
    roomId?: string,
  ): Availability[] {
    const span = interval(search);
    return (roomId ? [this.room(roomId)] : this.rooms()).map((room) => {
      const occupied =
        this.all<Booking>("bookings").some(
          (b) =>
            b.roomId === room.id &&
            !["cancelled", "rejected"].includes(b.status) &&
            overlaps(span, b),
        ) ||
        this.all<Block>("blocks").some(
          (b) => b.roomId === room.id && overlaps(span, b),
        );
      const reason =
        span.startTime < Date.now()
          ? translateMessage(locale, "time_past")
          : search.people > room.capacity
            ? translateMessage(locale, "too_many_participants")
            : occupied
              ? translateMessage(locale, "room_busy_partial")
              : undefined;
      return {
        roomId: room.id,
        state: reason ? ("unavailable" as const) : ("available" as const),
        reason,
      };
    });
  }
  bookings(user: User) {
    return this.all<Booking>("bookings")
      .filter((b) => b.userId === user.id)
      .sort((a, b) => a.startTime - b.startTime);
  }
  booking(id: string, user: User) {
    const b = this.all<Booking>("bookings").find((b) => b.id === id);
    if (!b || (!user.isAdmin && b.userId !== user.id))
      throw new AppError(
        404,
        "Bookingen ble ikke funnet.",
        "booking_not_found",
      );
    return b;
  }
  create(input: BookingInput, user: User, key: string): Booking {
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({ ...input, quoteToken: undefined, userId: user.id }),
      )
      .digest("hex");
    const requestKey = `${user.id}:${key}`;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const old = this.db
        .prepare("SELECT * FROM requests WHERE key = ?")
        .get(requestKey);
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new AppError(
            409,
            "Bestillingen ble endret. Kontroller opplysningene på nytt.",
            "booking_fingerprint_mismatch",
          );
        this.db.exec("COMMIT");
        return this.booking(String(old.booking), user);
      }
      const room = this.room(input.roomId);
      const availability = this.availability(input).find(
        (r) => r.roomId === input.roomId,
      );
      if (availability?.state !== "available")
        throw new AppError(
          409,
          availability?.reason || "Rommet er ikke ledig.",
          "room_unavailable",
        );
      const id = randomUUID();
      const booking: Booking = {
        id,
        reference: `DEMO-${id.slice(0, 8).toUpperCase()}`,
        roomId: room.id,
        roomName: room.name,
        userId: user.id,
        name: input.name,
        email: input.email,
        phone: input.phone || "",
        ...interval(input),
        people: input.people,
        title: input.title,
        notes: input.notes,
        status: room.requiresApproval ? "pending" : "confirmed",
        totalPrice: 0,
        currency: "NOK",
        paymentRequired: false,
        cancellationAllowed: true,
      };
      this.save("bookings", booking);
      this.db
        .prepare("INSERT INTO requests VALUES (?, ?, ?)")
        .run(requestKey, fingerprint, id);
      this.audit(user, "booking.created", id);
      this.db.exec("COMMIT");
      return booking;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }
  updateBooking(
    id: string,
    action: "cancel" | "approve" | "reject",
    user: User,
  ): Booking {
    const b = this.booking(id, user);
    if (action !== "cancel" && !user.isAdmin)
      throw new AppError(
        403,
        "Du har ikke tilgang til denne handlingen.",
        "action_forbidden",
      );
    if (action !== "cancel" && b.status !== "pending")
      throw new AppError(
        409,
        "Bookingen venter ikke på godkjenning.",
        "booking_not_pending",
      );
    b.status =
      action === "approve"
        ? "confirmed"
        : action === "reject"
          ? "rejected"
          : "cancelled";
    this.save("bookings", b);
    this.audit(user, `booking.${action}`, id);
    return b;
  }
  requestEdit(id: string, search: Search, user: User) {
    const b = this.booking(id, user);
    if (["cancelled", "rejected"].includes(b.status))
      throw new AppError(
        409,
        "Denne bookingen kan ikke endres.",
        "booking_not_editable",
      );
    if (interval(search).startTime < Date.now())
      throw new AppError(
        400,
        "Velg et fremtidig tidspunkt.",
        "future_time_required",
      );
    // The original interval remains reserved until the request is approved in Digilist.
    b.editRequested = true;
    b.notes =
      `${b.notes}\nØnsket endring: ${search.date} ${search.start}–${search.end}`.trim();
    this.save("bookings", b);
    this.audit(user, "booking.edit-requested", id);
    return b;
  }
  admin(user: User): AdminData {
    this.assertAdmin(user);
    return {
      rooms: this.rooms(),
      bookings: this.all<Booking>("bookings"),
      blocks: this.all<Block>("blocks"),
      truncated: false,
    };
  }
  listForInsights(
    user: User,
    opts: { fetchFrom: number; fetchTo: number },
  ): { bookings: InsightsBooking[]; truncated: boolean } {
    this.assertAdmin(user);
    return {
      truncated: false,
      bookings: this.all<Booking>("bookings")
        .filter((b) => b.endTime > opts.fetchFrom && b.startTime < opts.fetchTo)
        .map((b) => ({
          id: b.id,
          roomId: b.roomId,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          email: b.email,
        })),
    };
  }
  listBlocksForInsights(user: User): InsightsBlock[] {
    this.assertAdmin(user);
    return this.all<Block>("blocks");
  }
  assertAdmin(user: User) {
    if (!user.isAdmin)
      throw new AppError(
        403,
        "Du har ikke administratortilgang.",
        "admin_required",
      );
  }
  updateRoom(
    id: string,
    patch: {
      name: string;
      capacity: number;
      description: string;
      descriptionEn?: string;
      capacityLabel?: string;
      capacityLabelEn?: string;
      requiresApproval: boolean;
      image?: string;
      imageKind?: "illustrative" | "actual";
      amenities?: string[];
      arrivalInfo?: string;
    },
    user: User,
  ) {
    this.assertAdmin(user);
    const current = this.room(id);
    const image =
      patch.image !== undefined
        ? patch.image.trim() || undefined
        : current.image;
    const room = {
      ...current,
      ...patch,
      image,
      imageKind: image
        ? (patch.imageKind ?? current.imageKind ?? "illustrative")
        : undefined,
      amenities: patch.amenities ?? current.amenities ?? [],
      arrivalInfo: patch.arrivalInfo?.trim() || undefined,
      capacityLabel:
        patch.capacityLabel?.trim() || `${patch.capacity} personer`,
      capacityLabelEn:
        patch.capacityLabelEn?.trim() ||
        current.capacityLabelEn ||
        `${patch.capacity} people`,
      descriptionEn: patch.descriptionEn ?? current.descriptionEn ?? "",
    };
    this.save("rooms", room);
    this.audit(user, "room.updated", id);
    return room;
  }
  createBlock(roomId: string, search: Search, title: string, user: User) {
    this.assertAdmin(user);
    this.room(roomId);
    const span = interval(search);
    if (span.startTime < Date.now())
      throw new AppError(
        400,
        "Velg et fremtidig tidspunkt.",
        "future_time_required",
      );
    if (
      this.availability({ ...search, people: 1 }).find(
        (r) => r.roomId === roomId,
      )?.state !== "available"
    )
      throw new AppError(
        409,
        "Tidsrommet overlapper en booking eller blokkering.",
        "interval_overlaps",
      );
    const block: Block = { id: randomUUID(), roomId, title, ...span };
    this.save("blocks", block);
    this.audit(user, "block.created", block.id);
    return block;
  }
  removeBlock(id: string, user: User) {
    this.assertAdmin(user);
    this.db.prepare("DELETE FROM blocks WHERE id = ?").run(id);
    this.audit(user, "block.removed", id);
  }
  private conversations(): ConversationSummary[] {
    return this.all<ConversationSummary>("conversations")
      .map((c) => this.withContext(c))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  private bookingById(id: string): Booking | undefined {
    return this.all<Booking>("bookings").find((b) => b.id === id);
  }
  private withContext(conversation: ConversationSummary): ConversationSummary {
    const booking = conversation.bookingId
      ? this.bookingById(conversation.bookingId)
      : undefined;
    return enrichBookingConversation(
      {
        ...conversation,
        kind: conversation.kind || "booking",
      },
      booking,
      this.all<Room>("rooms"),
    );
  }
  private messagesFor(conversationId: string): Message[] {
    return this.db
      .prepare(
        "SELECT data FROM messages WHERE conversation_id = ? ORDER BY created ASC",
      )
      .all(conversationId)
      .map((row) => JSON.parse(String(row.data)) as Message);
  }
  private thread(conversation: ConversationSummary): ConversationThread {
    return {
      conversation: this.withContext(conversation),
      messages: this.messagesFor(conversation.id),
    };
  }
  private conversationForBooking(
    booking: Booking,
    create: boolean,
  ): ConversationSummary | null {
    const existing = this.conversations().find(
      (c) => c.bookingId === booking.id,
    );
    if (existing) return existing;
    if (!create) return null;
    const conversation: ConversationSummary = {
      id: randomUUID(),
      kind: "booking",
      bookingId: booking.id,
      roomId: booking.roomId,
      roomName: booking.roomName,
      subject: booking.roomName,
      preview: "",
      updatedAt: Date.now(),
      unread: 0,
      customerName: booking.name,
    };
    this.save("conversations", conversation);
    return this.withContext(conversation);
  }
  inbox(user: User): ConversationSummary[] {
    if (user.isAdmin) return this.conversations();
    const mine = new Set(this.bookings(user).map((b) => b.id));
    return this.conversations().filter(
      (c) => c.bookingId && mine.has(c.bookingId),
    );
  }
  bookingThread(bookingId: string, user: User): ConversationThread {
    const booking = this.booking(bookingId, user);
    const conversation = this.conversationForBooking(booking, false);
    return {
      conversation: conversation ? this.withContext(conversation) : null,
      messages: conversation ? this.messagesFor(conversation.id) : [],
    };
  }
  conversationThread(id: string, user: User): ConversationThread {
    const conversation = this.conversations().find((c) => c.id === id);
    if (!conversation)
      throw new AppError(
        404,
        "Samtalen ble ikke funnet.",
        "conversation_not_found",
      );
    if (!user.isAdmin) {
      if (!conversation.bookingId)
        throw new AppError(
          404,
          "Samtalen ble ikke funnet.",
          "conversation_not_found",
        );
      this.booking(conversation.bookingId, user);
    }
    return this.thread(conversation);
  }
  sendBookingMessage(
    bookingId: string,
    content: string,
    user: User,
    clientMessageId?: string,
  ): ConversationThread {
    const booking = this.booking(bookingId, user);
    const conversation = this.conversationForBooking(booking, true)!;
    return this.appendMessage(conversation, content, user, clientMessageId);
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
      .prepare("INSERT INTO messages VALUES (?, ?, ?, ?)")
      .run(message.id, conversation.id, createdAt, JSON.stringify(message));
    conversation.preview = content;
    conversation.updatedAt = createdAt;
    conversation.unread = user.isAdmin ? 0 : 1;
    this.save("conversations", conversation);
    this.audit(user, "message.sent", conversation.id);
    return this.thread(conversation);
  }
}
