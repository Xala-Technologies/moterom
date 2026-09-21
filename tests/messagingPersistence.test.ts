import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DemoStore } from "../server/demo";
import { MessagingLocalStore } from "../server/messagingLocal";
import rooms from "../config/rooms.json";
import { addDays, today } from "../shared/time";
import type { BookingInput, Room, User } from "../shared/types";

const customer: User = {
  id: "persist-customer",
  name: "Persist Test",
  email: "persist@example.invalid",
  isAdmin: false,
  isMember: true,
};
const admin: User = {
  ...customer,
  id: "persist-admin",
  name: "Persist Admin",
  isAdmin: true,
};

function tempDb(name: string): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), `moterom-${name}-`));
  return { dir, path: join(dir, `${name}.sqlite`) };
}

describe("message history survives reopening the database file", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  });

  it("keeps support thread messages after MessagingLocalStore reopen", () => {
    const { dir, path } = tempDb("support");
    dirs.push(dir);

    const first = new MessagingLocalStore(path);
    const opened = first.openSupport(
      customer,
      "Nettsiden laster sakte",
      randomUUID(),
    );
    const conversationId = opened.conversation!.id;
    expect(conversationId.startsWith("sup_")).toBe(true);
    expect(opened.messages).toHaveLength(1);

    const replied = first.sendConversationMessage(
      conversationId,
      "Takk, vi ser på det.",
      admin,
      randomUUID(),
    );
    expect(replied.messages).toHaveLength(2);
    first.db.close();

    const second = new MessagingLocalStore(path);
    const thread = second.conversationThread(conversationId, customer);
    expect(thread.conversation?.id).toBe(conversationId);
    expect(thread.conversation?.kind).toBe("support");
    expect(thread.messages.map((m) => m.content)).toEqual([
      "Nettsiden laster sakte",
      "Takk, vi ser på det.",
    ]);
    expect(second.inbox(admin).some((row) => row.id === conversationId)).toBe(
      true,
    );
    second.db.close();
  });

  it("keeps announcements and dismissals after reopen", () => {
    const { dir, path } = tempDb("announce");
    dirs.push(dir);

    const first = new MessagingLocalStore(path);
    const created = first.createAnnouncement(
      {
        title: "Heisen stenger",
        body: "Bruk trappen mellom 09 og 11.",
      },
      admin,
    );
    expect(first.activeForUser(admin)).toBeNull();
    expect(first.activeForUser(customer)?.id).toBe(created.id);
    first.dismissAnnouncement(created.id, customer);
    expect(first.activeForUser(customer)).toBeNull();
    first.db.close();

    const second = new MessagingLocalStore(path);
    expect(
      second.listAnnouncements().some((row) => row.id === created.id),
    ).toBe(true);
    expect(second.activeForUser(customer)).toBeNull();
    const listed = second
      .listAnnouncements()
      .find((row) => row.id === created.id);
    expect(listed?.title).toBe("Heisen stenger");
    expect(listed?.body).toBe("Bruk trappen mellom 09 og 11.");
    second.db.close();
  });

  it("keeps demo booking message history after DemoStore reopen", () => {
    const { dir, path } = tempDb("demo-messages");
    dirs.push(dir);

    const input: BookingInput = {
      roomId: (rooms as Room[])[0]!.id,
      date: addDays(today(), 12),
      start: "11:00",
      end: "12:00",
      people: 2,
      title: "Persist chat",
      notes: "",
      quoteToken: "",
      name: customer.name,
      email: customer.email,
    };

    const first = new DemoStore(path, rooms as Room[], false);
    const booking = first.create(input, customer, "persist-booking");
    const sent = first.sendBookingMessage(
      booking.id,
      "Trenger HDMI",
      customer,
      randomUUID(),
    );
    expect(sent.conversation?.kind).toBe("booking");
    expect(sent.conversation?.context?.bookingId).toBe(booking.id);
    expect(sent.messages).toHaveLength(1);

    const reply = first.sendConversationMessage(
      sent.conversation!.id,
      "HDMI ligger klart",
      admin,
      randomUUID(),
    );
    expect(reply.messages).toHaveLength(2);
    const conversationId = sent.conversation!.id;
    first.db.close();

    const second = new DemoStore(path, rooms as Room[], false);
    const thread = second.bookingThread(booking.id, customer);
    expect(thread.conversation?.id).toBe(conversationId);
    expect(thread.conversation?.kind).toBe("booking");
    expect(thread.conversation?.roomId).toBe(booking.roomId);
    expect(thread.conversation?.context?.bookingId).toBe(booking.id);
    expect(thread.messages.map((m) => m.content)).toEqual([
      "Trenger HDMI",
      "HDMI ligger klart",
    ]);
    second.db.close();
  });
});
