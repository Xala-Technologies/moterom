import { describe, expect, it } from "vitest";
import type { Booking } from "../shared/types";
import {
  bookingIsCancellable,
  toAdminBookingRow,
} from "../src/components/admin/adminBookingRow";

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
  it("builds approve and reject actions for pending bookings", () => {
    const row = toAdminBookingRow(base, {
      t: (key) => key,
      formatters,
      canApprove: true,
      canReject: true,
    });
    expect(row.actions.map((a) => a.id)).toEqual(["approve", "reject"]);
    expect(row.status).toBe("pending");
  });

  it("omits approve and reject when the booking is already confirmed", () => {
    const row = toAdminBookingRow(
      { ...base, status: "confirmed" },
      {
        t: (key) => key,
        formatters,
        canApprove: true,
        canReject: true,
      },
    );
    expect(row.actions).toEqual([]);
  });

  it("exposes follow-up, calendar, and cancel in the overflow set", () => {
    const future = Date.now() + 60 * 60 * 1000;
    const row = toAdminBookingRow(
      {
        ...base,
        status: "confirmed",
        startTime: future,
        endTime: future + 60 * 60 * 1000,
      },
      {
        t: (key) => key,
        formatters,
        canCancel: true,
        canMessage: true,
        canCalendar: true,
      },
    );
    expect(row.actions.map((a) => a.id)).toEqual([
      "message",
      "calendar",
      "cancel",
    ]);
    expect(row.actions.every((a) => !a.primary)).toBe(true);
    expect(row.actions.find((a) => a.id === "message")?.href).toBe(
      "/booking/b1#meldinger",
    );
  });

  it("keeps approve and reject as primary pending actions", () => {
    const future = Date.now() + 60 * 60 * 1000;
    const row = toAdminBookingRow(
      {
        ...base,
        status: "pending",
        startTime: future,
        endTime: future + 60 * 60 * 1000,
      },
      {
        t: (key) => key,
        formatters,
        canApprove: true,
        canReject: true,
        canCancel: true,
        canMessage: true,
        canCalendar: true,
      },
    );
    expect(row.actions.filter((a) => a.primary).map((a) => a.id)).toEqual([
      "approve",
      "reject",
    ]);
    expect(row.actions.filter((a) => !a.primary).map((a) => a.id)).toEqual([
      "message",
      "calendar",
      "cancel",
    ]);
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

  it("marks past and closed bookings as finished", () => {
    const future = Date.now() + 60_000;
    const past = Date.now() - 60_000;
    expect(
      toAdminBookingRow(
        {
          ...base,
          status: "confirmed",
          startTime: past - 3_600_000,
          endTime: past,
        },
        { t: (key) => key, formatters },
      ).finished,
    ).toBe(true);
    expect(
      toAdminBookingRow(
        {
          ...base,
          status: "cancelled",
          startTime: future,
          endTime: future + 3_600_000,
        },
        { t: (key) => key, formatters },
      ).finished,
    ).toBe(true);
    expect(
      toAdminBookingRow(
        {
          ...base,
          status: "confirmed",
          startTime: future,
          endTime: future + 3_600_000,
        },
        { t: (key) => key, formatters },
      ).finished,
    ).toBe(false);
  });
});

describe("bookingIsCancellable", () => {
  it("allows open future bookings and blocks closed or past ones", () => {
    const future = Date.now() + 10_000;
    const past = Date.now() - 10_000;
    expect(
      bookingIsCancellable({
        status: "confirmed",
        endTime: future,
      }),
    ).toBe(true);
    expect(
      bookingIsCancellable({
        status: "pending",
        endTime: future,
        cancellationAllowed: false,
      }),
    ).toBe(false);
    expect(
      bookingIsCancellable({
        status: "cancelled",
        endTime: future,
      }),
    ).toBe(false);
    expect(
      bookingIsCancellable({
        status: "confirmed",
        endTime: past,
      }),
    ).toBe(false);
  });
});
