import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { addDays, today } from "../shared/time";
process.env.DATA_MODE = "demo";
process.env.DEMO_DB_PATH = ":memory:";
process.env.FLOORPLAN_PATH = "/nonexistent-moterom-test-floorplan.png";
process.env.PUBLIC_ORIGIN = "http://localhost:4173";
process.env.SESSION_SECRET = "test-only-secret-that-is-not-a-production-secret";
const { app } = await import("../server/app");
const origin = "http://localhost:4173";
const customer = request.agent(app);
const administrator = request.agent(app);
const contact = {
  name: "Kari Nordmann",
  email: "kari@example.invalid",
};
let roomId: string;
beforeAll(async () => {
  const login = await customer
    .post("/api/auth/demo")
    .set("Origin", origin)
    .send({ role: "customer" })
    .expect(200);
  expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
  await administrator
    .post("/api/auth/demo")
    .set("Origin", origin)
    .send({ role: "admin" })
    .expect(200);
  roomId = (await customer.get("/api/rooms").expect(200)).body[0].id;
  const catalogue = (await customer.get("/api/rooms")).body as Array<{
    image?: string;
    imageKind?: string;
  }>;
  expect(catalogue[0]?.imageKind).toBe("illustrative");
  expect(catalogue[0]?.image).toMatch(/\.webp$/);
});
describe("HTTP boundaries and complete booking lifecycle", () => {
  it("hides the optional floor plan when no approved asset is configured", async () => {
    expect((await customer.get("/api/config")).body.floorplanAvailable).toBe(
      false,
    );
    await customer.get("/api/floorplan").expect(404);
  });
  it("requires sign-in and rejects cross-origin writes and customer admin access", async () => {
    await request(app).get("/api/bookings").expect(401);
    await request(app)
      .post("/api/auth/demo")
      .set("Origin", "https://other.invalid")
      .set("Host", "localhost:4173")
      .send({ role: "admin" })
      .expect(403);
    await request(app)
      .post("/api/auth/demo")
      .set("Origin", "https://moterom.vercel.app")
      .set("Host", "moterom.vercel.app")
      .send({ role: "admin" })
      .expect(200);
    await customer.get("/api/admin").expect(403);
    await administrator.get("/api/admin").expect(200);
    await customer.get("/api/bookings/example-1").expect(404);
  });
  it("rejects malformed dates and times as client errors", async () => {
    await customer
      .get("/api/availability")
      .query({ date: "2026-10-25", start: "02:30", end: "03:30", people: 1 })
      .expect(400);
  });
  it("lists one-hour slots and marks occupied rooms unavailable", async () => {
    const date = addDays(today(), 1);
    const all = (
      await customer.get("/api/availability/slots").query({ date }).expect(200)
    ).body as Array<{ start: string; state: string }>;
    expect(all.find((slot) => slot.start === "08:00")?.state).toBe("available");
    const tysso = (
      await customer
        .get("/api/availability/slots")
        .query({ date, roomId: "tysso" })
        .expect(200)
    ).body as Array<{ start: string; state: string }>;
    expect(tysso.find((slot) => slot.start === "09:00")?.state).toBe(
      "unavailable",
    );
    expect(tysso.find((slot) => slot.start === "14:00")?.state).toBe(
      "available",
    );
  });
  it("lets a demo guest quote and book with name and email", async () => {
    const guest = request.agent(app);
    const search = {
      roomId,
      date: addDays(today(), 18),
      start: "13:00",
      end: "14:00",
      people: 2,
    };
    const quote = (
      await guest
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    await guest
      .post("/api/bookings")
      .set("Origin", origin)
      .set("Idempotency-Key", randomUUID())
      .send({
        ...search,
        title: "",
        notes: "",
        quoteToken: quote.token,
        name: "Ola Nordmann",
      })
      .expect(400);
    await guest
      .post("/api/bookings")
      .set("Origin", origin)
      .set("Idempotency-Key", randomUUID())
      .send({
        ...search,
        title: "",
        notes: "",
        quoteToken: quote.token,
        name: "Ola Nordmann",
        email: "ola@example.invalid",
        phone: "12",
      })
      .expect(400);
    const created = (
      await guest
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...search,
          title: "",
          notes: "",
          quoteToken: quote.token,
          name: "Ola Nordmann",
          email: "ola@example.invalid",
          phone: "41234567",
        })
        .expect(201)
    ).body;
    expect(created.name).toBe("Ola Nordmann");
    expect(created.email).toBe("ola@example.invalid");
    expect(created.phone).toBe("41234567");
    await guest.get(`/api/bookings/${created.id}`).expect(200);
    await request(app).get(`/api/bookings/${created.id}`).expect(401);
  });
  it("requires a matching signed quote, then books, retries, exports and cancels", async () => {
    const search = {
      roomId,
      date: addDays(today(), 12),
      start: "09:00",
      end: "10:00",
      people: 4,
    };
    const quote = (
      await customer
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    const key = randomUUID();
    const body = {
      ...search,
      title: "Test booking",
      notes: "",
      quoteToken: quote.token,
      ...contact,
    };
    await customer
      .post("/api/bookings")
      .set("Origin", origin)
      .set("Idempotency-Key", key)
      .send({ ...body, people: 5 })
      .expect(409);
    const first = (
      await customer
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", key)
        .send(body)
        .expect(201)
    ).body;
    const replay = (
      await customer
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", key)
        .send(body)
        .expect(201)
    ).body;
    expect(replay.id).toBe(first.id);
    const calendar = await customer
      .get(`/api/bookings/${first.id}/calendar.ics`)
      .expect(200);
    expect(calendar.text).toContain("BEGIN:VCALENDAR");
    expect(calendar.text).toContain("STATUS:CONFIRMED");
    await customer
      .post(`/api/bookings/${first.id}/cancel`)
      .set("Origin", origin)
      .send({})
      .expect(200);
    expect((await customer.get(`/api/bookings/${first.id}`)).body.status).toBe(
      "cancelled",
    );
  });
  it("lets an administrator approve, reject, block and update a room", async () => {
    const search = {
      roomId,
      date: addDays(today(), 14),
      start: "11:00",
      end: "12:00",
      people: 2,
    };
    const pendingRoom = (await administrator.get("/api/admin").expect(200)).body
      .rooms[1];
    const original = (
      await administrator
        .patch(`/api/admin/rooms/${pendingRoom.id}`)
        .set("Origin", origin)
        .send({
          name: pendingRoom.name,
          capacity: pendingRoom.capacity,
          description: pendingRoom.description,
          requiresApproval: true,
        })
        .expect(200)
    ).body;
    expect(original.requiresApproval).toBe(true);
    const approvalQuote = (
      await customer
        .post("/api/quote")
        .set("Origin", origin)
        .send({ ...search, roomId: pendingRoom.id })
        .expect(200)
    ).body;
    expect(approvalQuote.requiresApproval).toBe(true);
    const requested = (
      await customer
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...search,
          roomId: pendingRoom.id,
          title: "Godkjenning",
          notes: "",
          quoteToken: approvalQuote.token,
          ...contact,
        })
        .expect(201)
    ).body;
    expect(requested.status).toBe("pending");
    await customer
      .post(`/api/bookings/${requested.id}/approve`)
      .set("Origin", origin)
      .send({})
      .expect(403);
    expect(
      (
        await administrator
          .post(`/api/bookings/${requested.id}/approve`)
          .set("Origin", origin)
          .send({})
          .expect(200)
      ).body.status,
    ).toBe("confirmed");
    const later = {
      ...search,
      date: addDays(today(), 15),
      start: "13:00",
      end: "14:00",
    };
    const laterQuote = (
      await customer
        .post("/api/quote")
        .set("Origin", origin)
        .send({ ...later, roomId: pendingRoom.id })
        .expect(200)
    ).body;
    const second = (
      await customer
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...later,
          roomId: pendingRoom.id,
          title: "Avslag",
          notes: "",
          quoteToken: laterQuote.token,
          ...contact,
        })
        .expect(201)
    ).body;
    expect(
      (
        await administrator
          .post(`/api/bookings/${second.id}/reject`)
          .set("Origin", origin)
          .send({})
          .expect(200)
      ).body.status,
    ).toBe("rejected");
    const block = (
      await administrator
        .post("/api/admin/blocks")
        .set("Origin", origin)
        .send({
          roomId,
          date: addDays(today(), 16),
          start: "09:00",
          end: "10:00",
          people: 1,
          title: "Vedlikehold",
        })
        .expect(201)
    ).body;
    const availability = (
      await customer
        .get("/api/availability")
        .query({
          date: addDays(today(), 16),
          start: "09:00",
          end: "10:00",
          people: 1,
        })
        .expect(200)
    ).body as Array<{ roomId: string; state: string }>;
    expect(availability.find((item) => item.roomId === roomId)?.state).toBe(
      "unavailable",
    );
    await customer
      .delete(`/api/admin/blocks/${block.id}`)
      .set("Origin", origin)
      .expect(403);
    await administrator
      .delete(`/api/admin/blocks/${block.id}`)
      .set("Origin", origin)
      .expect(200);
    await administrator
      .patch(`/api/admin/rooms/${pendingRoom.id}`)
      .set("Origin", origin)
      .send({
        name: pendingRoom.name,
        capacity: pendingRoom.capacity,
        description: pendingRoom.description,
        requiresApproval: false,
      })
      .expect(200);
  });
  it("keeps admin insights behind administrator access", async () => {
    await customer.get("/api/admin/insights").expect(403);
    const insights = await administrator.get("/api/admin/insights").expect(200);
    expect(insights.body.timezone).toBe("Europe/Oslo");
    expect(insights.body.coverage).toBe("complete");
    expect(insights.body.rooms.length).toBeGreaterThan(0);
    expect(insights.body.rooms[0]).not.toHaveProperty("email");
    await administrator
      .get("/api/admin/insights")
      .query({ rom: "does-not-exist" })
      .expect(400);
    await administrator
      .get("/api/admin/insights/rooms/does-not-exist")
      .expect(404);
  });
});
