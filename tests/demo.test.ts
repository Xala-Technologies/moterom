import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DemoStore } from "../server/demo";
import rooms from "../config/rooms.json";
import { addDays, today } from "../shared/time";
import type { BookingInput, Room, User } from "../shared/types";
const customer: User = {
  id: "customer",
  name: "Test",
  email: "test@example.invalid",
  isAdmin: false,
  isMember: true,
};
const admin: User = { ...customer, id: "admin", isAdmin: true };
const input: BookingInput = {
  roomId: rooms[0].id,
  date: addDays(today(), 10),
  start: "09:00",
  end: "10:00",
  people: 4,
  title: "",
  notes: "",
  quoteToken: "",
  name: "Test",
  email: "test@example.invalid",
};
describe("persistent demo booking rules", () => {
  let store: DemoStore;
  beforeEach(() => {
    store = new DemoStore(":memory:", rooms as Room[], false);
  });
  afterEach(() => store.db.close());
  it("stores the submitted name, email and phone on the booking", () => {
    const booking = store.create(
      {
        ...input,
        name: "Ola Nordmann",
        email: "ola@example.invalid",
        phone: "412 34 567",
      },
      customer,
      "guest-name",
    );
    expect(booking.name).toBe("Ola Nordmann");
    expect(booking.email).toBe("ola@example.invalid");
    expect(booking.phone).toBe("412 34 567");
  });
  it("replays a request without creating another reservation", () => {
    const first = store.create(input, customer, "one");
    expect(store.create(input, customer, "one").id).toBe(first.id);
    expect(store.bookings(customer)).toHaveLength(1);
    expect(() =>
      store.create({ ...input, people: 5 }, customer, "one"),
    ).toThrow();
  });
  it("prevents overlaps and releases the interval after cancellation", () => {
    const first = store.create(input, customer, "one");
    expect(() =>
      store.create({ ...input, start: "09:30", end: "10:30" }, admin, "two"),
    ).toThrow();
    store.create({ ...input, start: "10:00", end: "11:00" }, admin, "adjacent");
    store.updateBooking(first.id, "cancel", customer);
    expect(store.create(input, customer, "three").status).toBe("confirmed");
  });
  it("enforces ownership, capacity and admin access", () => {
    const first = store.create(input, customer, "one");
    expect(() =>
      store.booking(first.id, { ...customer, id: "other" }),
    ).toThrow();
    expect(() =>
      store.create({ ...input, people: 100 }, customer, "two"),
    ).toThrow();
    expect(() => store.admin(customer)).toThrow();
    expect(() => store.updateBooking(first.id, "approve", customer)).toThrow();
  });
  it("blocks booking during maintenance and preserves original edit intervals", () => {
    const block = store.createBlock(input.roomId, input, "Vedlikehold", admin);
    expect(() => store.create(input, customer, "one")).toThrow();
    store.removeBlock(block.id, admin);
    expect(() => store.removeBlock(block.id, admin)).toThrow();
    const first = store.create(input, customer, "two");
    const edited = store.requestEdit(
      first.id,
      { ...input, start: "12:00", end: "13:00" },
      customer,
    );
    expect(edited.startTime).toBe(first.startTime);
    expect(edited.editRequested).toBe(true);
    expect(() =>
      store.createBlock(input.roomId, input, "Konflikt", admin),
    ).toThrow();
  });
});
