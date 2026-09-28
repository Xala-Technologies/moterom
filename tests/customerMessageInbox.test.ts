import { describe, expect, it } from "vitest";
import {
  conversationSelectionKey,
  filterCustomerMessageInbox,
  findConversation,
  mergeCustomerMessageInbox,
  threadEndpoint,
} from "../src/customerMessageInbox";
import type { Booking, ConversationSummary } from "../shared/types";

const summary = (
  partial: Partial<ConversationSummary> & Pick<ConversationSummary, "id">,
): ConversationSummary => ({
  kind: "booking",
  roomName: "Sauda 1",
  subject: "Sauda 1",
  preview: "Hei",
  updatedAt: 1,
  unread: 0,
  customerName: "Kari",
  ...partial,
});

const booking = (id: string, start: number): Booking => ({
  id,
  reference: `REF-${id}`,
  roomId: "sauda-1",
  roomName: "Sauda 1",
  userId: "demo-customer",
  name: "Kari",
  email: "kari@example.com",
  startTime: start,
  endTime: start + 3600000,
  people: 2,
  title: "Møte",
  notes: "",
  status: "confirmed",
  totalPrice: 0,
  currency: "NOK",
  paymentRequired: false,
});

describe("mergeCustomerMessageInbox", () => {
  it("keeps open bookings in the list before the first message", () => {
    const support: ConversationSummary = {
      id: "sup_1",
      kind: "support",
      roomName: "",
      subject: "Generell henvendelse",
      preview: "Hei",
      updatedAt: Date.now(),
      unread: 0,
      customerName: "Kari",
    };
    const open = booking("b1", Date.now() + 86400000);
    const merged = mergeCustomerMessageInbox([support], [open], "Ingen ennå");
    expect(merged.some((row) => row.kind === "support")).toBe(true);
    expect(merged.some((row) => row.bookingId === "b1")).toBe(true);
    expect(merged.find((row) => row.bookingId === "b1")?.preview).toBe(
      "Ingen ennå",
    );
  });

  it("uses booking id for selection and thread endpoint", () => {
    const row: ConversationSummary = {
      id: "booking:b1",
      kind: "booking",
      bookingId: "b1",
      roomName: "Sauda 1",
      subject: "Sauda 1",
      preview: "",
      updatedAt: 1,
      unread: 0,
      customerName: "Kari",
    };
    expect(conversationSelectionKey(row)).toBe("b1");
    expect(threadEndpoint(row)).toBe("/bookings/b1/messages");
    expect(findConversation([row], "b1")?.id).toBe("booking:b1");
  });
});

describe("filterCustomerMessageInbox", () => {
  const rows = [
    summary({ id: "u1", unread: 2, roomName: "Glomma 1", kind: "booking" }),
    summary({
      id: "r1",
      unread: 0,
      roomName: "Sauda 2",
      kind: "booking",
      preview: "Takk",
    }),
    summary({
      id: "s1",
      kind: "support",
      unread: 1,
      roomName: "",
      subject: "Generell henvendelse",
      preview: "Heisann",
    }),
  ];

  it("filters by unread and read", () => {
    expect(
      filterCustomerMessageInbox(rows, {
        query: "",
        read: "unread",
        kind: "all",
      }).map((row) => row.id),
    ).toEqual(["u1", "s1"]);
    expect(
      filterCustomerMessageInbox(rows, {
        query: "",
        read: "read",
        kind: "all",
      }).map((row) => row.id),
    ).toEqual(["r1"]);
  });

  it("filters by kind and search query", () => {
    expect(
      filterCustomerMessageInbox(rows, {
        query: "",
        read: "all",
        kind: "support",
      }).map((row) => row.id),
    ).toEqual(["s1"]);
    expect(
      filterCustomerMessageInbox(rows, {
        query: "glomma",
        read: "all",
        kind: "all",
      }).map((row) => row.id),
    ).toEqual(["u1"]);
  });
});
