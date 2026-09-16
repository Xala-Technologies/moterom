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
  Room,
  Search,
  User,
} from "../shared/types";
import { addDays, interval, overlaps, today } from "../shared/time";
import { AppError } from "../shared/validation";
export class DemoStore {
  db: DatabaseSync;
  constructor(path: string, seedRooms: Room[], seed = true) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS requests (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, booking TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, created INTEGER NOT NULL);",
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
  private all<T>(table: "rooms" | "bookings" | "blocks"): T[] {
    return this.db
      .prepare(`SELECT data FROM ${table}`)
      .all()
      .map((row) => JSON.parse(String(row.data)) as T);
  }
  private save(table: "rooms" | "bookings" | "blocks", value: { id: string }) {
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
    return this.all<Room>("rooms");
  }
  room(id: string) {
    const room = this.rooms().find((r) => r.id === id);
    if (!room) throw new AppError(404, "Rommet ble ikke funnet.");
    return room;
  }
  availability(search: Search): Availability[] {
    const span = interval(search);
    return this.rooms().map((room) => {
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
          ? "Tidspunktet har passert."
          : search.people > room.capacity
            ? "For mange deltakere."
            : occupied
              ? "Opptatt i deler av tidsrommet."
              : undefined;
      return {
        roomId: room.id,
        state: reason ? "unavailable" : "available",
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
      throw new AppError(404, "Bookingen ble ikke funnet.");
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
        );
      const id = randomUUID();
      const booking: Booking = {
        id,
        reference: `DEMO-${id.slice(0, 8).toUpperCase()}`,
        roomId: room.id,
        roomName: room.name,
        userId: user.id,
        name: user.name,
        email: user.email,
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
      throw new AppError(403, "Du har ikke tilgang til denne handlingen.");
    if (action !== "cancel" && b.status !== "pending")
      throw new AppError(409, "Bookingen venter ikke på godkjenning.");
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
      throw new AppError(409, "Denne bookingen kan ikke endres.");
    if (interval(search).startTime < Date.now())
      throw new AppError(400, "Velg et fremtidig tidspunkt.");
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
  assertAdmin(user: User) {
    if (!user.isAdmin)
      throw new AppError(403, "Du har ikke administratortilgang.");
  }
  updateRoom(
    id: string,
    patch: Pick<Room, "name" | "capacity" | "description" | "requiresApproval">,
    user: User,
  ) {
    this.assertAdmin(user);
    const room = {
      ...this.room(id),
      ...patch,
      capacityLabel: `${patch.capacity} personer`,
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
      throw new AppError(400, "Velg et fremtidig tidspunkt.");
    if (
      this.availability({ ...search, people: 1 }).find(
        (r) => r.roomId === roomId,
      )?.state !== "available"
    )
      throw new AppError(
        409,
        "Tidsrommet overlapper en booking eller blokkering.",
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
}
