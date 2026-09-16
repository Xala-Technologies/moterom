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
      .send({ role: "admin" })
      .expect(403);
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
});
