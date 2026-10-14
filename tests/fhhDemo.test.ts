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

describe("FHH demo acceptance", () => {
  let elvebredden: string;
  let bakgarden: string;
  let sal1: string;

  beforeAll(async () => {
    const anon = await request(app).get("/api/rooms").expect(200);
    const rooms = anon.body as Array<{
      id: string;
      demoHourlyPrices?: unknown;
    }>;
    elvebredden = rooms.find((r) => r.id === "elvebredden")!.id;
    bakgarden = "bakgarden";
    sal1 = rooms.find((r) => r.id === "sal-1")!.id;
    expect(rooms.some((r) => r.id === "bakgarden")).toBe(false);
    expect(
      rooms.find((r) => r.id === "elvebredden")?.demoHourlyPrices,
    ).toMatchObject({
      internal: 400,
      ideal: 560,
      external: 800,
    });
  });

  it("exposes demo public config", async () => {
    const config = (await request(app).get("/api/config").expect(200)).body;
    expect(config.mode).toBe("demo");
    expect(config.access).toBe("public");
    expect(config.buildingName).toBe("Frivillighetens Hus");
  });

  it("rejects anonymous quote and booking", async () => {
    const search = {
      roomId: elvebredden,
      date: addDays(today(), 20),
      start: "10:00",
      end: "11:00",
      people: 1,
    };
    await request(app)
      .post("/api/quote")
      .set("Origin", origin)
      .send(search)
      .expect(401);
  });

  it("hides and blocks Bakgården for external users", async () => {
    const external = await login("external");
    const rooms = (await external.get("/api/rooms").expect(200)).body as Array<{
      id: string;
    }>;
    expect(rooms.some((r) => r.id === bakgarden)).toBe(false);
    await external
      .get("/api/availability/slots")
      .query({ date: addDays(today(), 21), roomId: bakgarden })
      .expect(403);
    await external
      .post("/api/quote")
      .set("Origin", origin)
      .send({
        roomId: bakgarden,
        date: addDays(today(), 21),
        start: "10:00",
        end: "11:00",
        people: 1,
        category: "internal",
      })
      .expect(403);
  });

  it("lets internal users see Bakgården and get lower Elvebredden quote", async () => {
    const external = await login("external");
    const internal = await login("internal");
    const search = {
      roomId: elvebredden,
      date: addDays(today(), 22),
      start: "10:00",
      end: "11:00",
      people: 1,
    };
    const extQuote = (
      await external
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    const intQuote = (
      await internal
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    expect(extQuote.total).toBe(800);
    expect(intQuote.total).toBe(400);
    const rooms = (await internal.get("/api/rooms").expect(200)).body as Array<{
      id: string;
    }>;
    expect(rooms.some((r) => r.id === bakgarden)).toBe(true);
  });

  it("holds pending sal bookings in availability and stores terms", async () => {
    const external = await login("external");
    const admin = await login("admin");
    const search = {
      roomId: sal1,
      date: addDays(today(), 23),
      start: "10:00",
      end: "11:00",
      people: 1,
    };
    const quote = (
      await external
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    expect(quote.requiresApproval).toBe(true);
    await external
      .post("/api/bookings")
      .set("Origin", origin)
      .set("Idempotency-Key", randomUUID())
      .send({
        ...search,
        title: "Sal",
        notes: "",
        quoteToken: quote.token,
        name: "Ekstern bruker",
        email: "ekstern@example.invalid",
      })
      .expect(400);
    const created = (
      await external
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...search,
          title: "Sal",
          notes: "",
          quoteToken: quote.token,
          name: "Ekstern bruker",
          email: "ekstern@example.invalid",
          acceptedTerms: true,
        })
        .expect(201)
    ).body;
    expect(created.status).toBe("pending");
    expect(created.termsVersion).toBeTruthy();
    expect(created.cancelDeadlineDays).toBe(30);
    const slots = (
      await request(app)
        .get("/api/availability/slots")
        .query({ date: search.date, roomId: sal1 })
        .expect(200)
    ).body as Array<{ start: string; state: string }>;
    expect(slots.find((s) => s.start === "10:00")?.state).toBe("unavailable");
    const confirmed = (
      await admin
        .post(`/api/bookings/${created.id}/approve`)
        .set("Origin", origin)
        .send({})
        .expect(200)
    ).body;
    expect(confirmed.status).toBe("confirmed");
  });
});
