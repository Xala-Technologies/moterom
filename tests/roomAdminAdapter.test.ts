import { describe, expect, it } from "vitest";
import type { Booking } from "../shared/types";
import { toAdminBookingRow } from "../src/components/admin/adminBookingRow";

const formatters = {
  displayDate: () => "torsdag 17. september 2026",
  shortTime: (ms: number) => (ms === 1 ? "10:00" : "11:00"),
  money: (amount: number, currency: string) => `${amount} ${currency}`,
};

const base: Booking = {
  id: "b1",
  reference: "DEMO-1",
  roomId: "sauda-1",
  roomName: "Sauda 1",
  userId: "u1",
  name: "Kari Nordmann",
  email: "kari@example.invalid",
  startTime: 1,
  endTime: 2,
  people: 4,
  title: "Møte",
  notes: "",
  status: "pending",
  totalPrice: 500,
  currency: "NOK",
  paymentRequired: false,
};

describe("toAdminBookingRow", () => {
  it("does not invent a paid badge from price alone", () => {
    const row = toAdminBookingRow(base, {
      t: (key) => key,
      formatters,
      canApprove: true,
      canReject: true,
    });
    expect(row.paymentAmountLabel).toBe("500 NOK");
    expect(row.paymentTone).toBe("none");
    expect(row.paymentStatusLabel).toBeNull();
    expect(row.actions.map((a) => a.id)).toEqual(["approve", "reject"]);
  });

  it("marks outstanding payment only when the server requires it", () => {
    const row = toAdminBookingRow(
      { ...base, paymentRequired: true, status: "confirmed" },
      {
        t: (key) => key,
        formatters,
      },
    );
    expect(row.paymentTone).toBe("unpaid");
    expect(row.paymentStatusLabel).toBe("booking.payment_outstanding");
    expect(row.actions).toEqual([]);
  });

  it("passes through illustrative image provenance from the room", () => {
    const row = toAdminBookingRow(base, {
      t: (key) => key,
      formatters,
      room: {
        id: "sauda-1",
        name: "Sauda 1",
        slug: "sauda-1",
        capacity: 8,
        capacityLabel: "8",
        capacityLabelEn: "8",
        description: "",
        descriptionEn: "",
        image: "/rooms/sauda-1.webp",
        imageKind: "illustrative",
        amenities: [],
        requiresApproval: false,
      },
    });
    expect(row.imageUrl).toBe("/rooms/sauda-1.webp");
    expect(row.imageKind).toBe("illustrative");
  });
});
