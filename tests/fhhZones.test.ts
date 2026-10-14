import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { addDays, today } from "../shared/time";

process.env.DATA_MODE = "demo";
process.env.DEMO_DB_PATH = ":memory:";
process.env.ACCESS_REQUESTS_DB_PATH = ":memory:";
process.env.MESSAGING_LOCAL_DB_PATH = ":memory:";
process.env.PORTAL_ROLES_DB_PATH = ":memory:";
process.env.PORTAL_ACCESS_DB_PATH = ":memory:";
process.env.FLOORPLAN_PATH = "/nonexistent-moterom-test-floorplan.png";
process.env.PUBLIC_ORIGIN = "http://localhost:4173";
process.env.SESSION_SECRET = "test-only-secret-that-is-not-a-production-secret";
process.env.BOOKING_ACCESS = "public";
process.env.BUILDING_NAME = "Frivillighetens Hus";

const { app } = await import("../server/app");
const origin = "http://localhost:4173";

async function login(role: "external" | "internal" | "admin") {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/demo")
    .set("Origin", origin)
    .send({ role })
    .expect(200);
  return agent;
}

/** Quote or booking may return 409 when a zone is held. */
async function book(
  agent: ReturnType<typeof request.agent>,
  roomId: string,
  date: string,
  start: string,
  end: string,
  key = randomUUID(),
) {
  const search = { roomId, date, start, end, people: 1 };
  const quoteRes = await agent
    .post("/api/quote")
    .set("Origin", origin)
    .send(search);
  if (quoteRes.status !== 200) return quoteRes;
  return agent
    .post("/api/bookings")
    .set("Origin", origin)
    .set("Idempotency-Key", key)
    .send({
      ...search,
      title: "Sone",
      notes: "",
      quoteToken: quoteRes.body.token,
      name: "Test",
      email: "zone@example.invalid",
      acceptedTerms: true,
    });
}

describe("FHH hall zone conflicts", () => {
  let day = 40;

  beforeAll(async () => {
    const rooms = (await request(app).get("/api/rooms").expect(200))
      .body as Array<{
      id: string;
    }>;
    expect(rooms.some((r) => r.id === "sal-1-2")).toBe(true);
    expect(rooms.some((r) => r.id === "sal-1-3")).toBe(true);
  });

  function nextDate() {
    day += 1;
    return addDays(today(), day);
  }

  it("allows Sal 3 while Sal 1–2 is booked, blocks Sal 1 / Sal 1–3", async () => {
    const external = await login("external");
    const date = nextDate();
    expect(
      (await book(external, "sal-1-2", date, "10:00", "12:00")).status,
    ).toBe(201);
    expect((await book(external, "sal-3", date, "10:00", "12:00")).status).toBe(
      201,
    );
    expect((await book(external, "sal-1", date, "11:00", "13:00")).status).toBe(
      409,
    );
    expect(
      (await book(external, "sal-1-3", date, "10:00", "11:00")).status,
    ).toBe(409);
  });

  it("allows a booking that starts when Sal 1–2 ends (half-open)", async () => {
    const external = await login("external");
    const date = nextDate();
    expect(
      (await book(external, "sal-1-2", date, "10:00", "12:00")).status,
    ).toBe(201);
    expect((await book(external, "sal-1", date, "12:00", "13:00")).status).toBe(
      201,
    );
  });

  it("allows Sal 1–2 while Sal 3 is booked", async () => {
    const external = await login("external");
    const date = nextDate();
    expect((await book(external, "sal-3", date, "10:00", "12:00")).status).toBe(
      201,
    );
    expect(
      (await book(external, "sal-1-2", date, "10:00", "12:00")).status,
    ).toBe(201);
  });

  it("blocks every hall variant when Sal 1–3 is booked", async () => {
    const external = await login("external");
    const date = nextDate();
    expect(
      (await book(external, "sal-1-3", date, "10:00", "12:00")).status,
    ).toBe(201);
    for (const roomId of ["sal-1", "sal-2", "sal-3", "sal-1-2"] as const) {
      expect(
        (await book(external, roomId, date, "10:00", "11:00")).status,
      ).toBe(409);
    }
  });

  it("holds pending Sal 1–2 against Sal 1; cancel frees the zone", async () => {
    const external = await login("external");
    const date = nextDate();
    const created = await book(external, "sal-1-2", date, "10:00", "12:00");
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("pending");
    expect((await book(external, "sal-1", date, "10:00", "11:00")).status).toBe(
      409,
    );
    await external
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set("Origin", origin)
      .send({})
      .expect(200);
    expect((await book(external, "sal-1", date, "10:00", "11:00")).status).toBe(
      201,
    );
  });

  it("blocks Sal 1–3 when admin blocks Sal 3", async () => {
    const admin = await login("admin");
    const external = await login("external");
    const date = nextDate();
    await admin
      .post("/api/admin/blocks")
      .set("Origin", origin)
      .send({
        roomId: "sal-3",
        date,
        start: "10:00",
        end: "12:00",
        people: 1,
        title: "Vedlikehold",
      })
      .expect(201);
    expect(
      (await book(external, "sal-1-3", date, "10:00", "11:00")).status,
    ).toBe(409);
    expect(
      (await book(external, "sal-1-2", date, "10:00", "11:00")).status,
    ).toBe(201);
  });

  it("allows only one of two concurrent overlapping zone bookings", async () => {
    const a = await login("external");
    const b = await login("external");
    const date = nextDate();
    const searchA = {
      roomId: "sal-1",
      date,
      start: "10:00",
      end: "12:00",
      people: 1,
    };
    const searchB = {
      roomId: "sal-1-2",
      date,
      start: "10:00",
      end: "12:00",
      people: 1,
    };
    const quoteA = (
      await a.post("/api/quote").set("Origin", origin).send(searchA).expect(200)
    ).body;
    const quoteB = (
      await b.post("/api/quote").set("Origin", origin).send(searchB).expect(200)
    ).body;
    const [r1, r2] = await Promise.all([
      a
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...searchA,
          title: "A",
          notes: "",
          quoteToken: quoteA.token,
          name: "A",
          email: "a@example.invalid",
          acceptedTerms: true,
        }),
      b
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...searchB,
          title: "B",
          notes: "",
          quoteToken: quoteB.token,
          name: "B",
          email: "b@example.invalid",
          acceptedTerms: true,
        }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("returns the same booking for a repeated idempotency key", async () => {
    const external = await login("external");
    const date = nextDate();
    const key = randomUUID();
    const search = {
      roomId: "sal-2",
      date,
      start: "14:00",
      end: "15:00",
      people: 1,
    };
    const quote = (
      await external
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    const body = {
      ...search,
      title: "Sone",
      notes: "",
      quoteToken: quote.token,
      name: "Test",
      email: "zone@example.invalid",
      acceptedTerms: true as const,
    };
    const first = await external
      .post("/api/bookings")
      .set("Origin", origin)
      .set("Idempotency-Key", key)
      .send(body);
    const second = await external
      .post("/api/bookings")
      .set("Origin", origin)
      .set("Idempotency-Key", key)
      .send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
  });
});
