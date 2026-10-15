import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { addDays, today } from "../shared/time";

process.env.DATA_MODE = "demo";
process.env.DEMO_DB_PATH = ":memory:";
process.env.ORGANIZATIONS_DB_PATH = ":memory:";
process.env.ACCESS_REQUESTS_DB_PATH = ":memory:";
process.env.MESSAGING_LOCAL_DB_PATH = ":memory:";
process.env.PORTAL_ROLES_DB_PATH = ":memory:";
process.env.PORTAL_ACCESS_DB_PATH = ":memory:";
process.env.BRREG_MODE = "fixture";
process.env.PRICE_RULE = "cheapest_valid";
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

describe("FHH organisations and Brønnøysund", () => {
  let elvebredden: string;
  let kfukId: string;
  let idealId: string;

  beforeAll(async () => {
    const admin = await login("admin");
    const payload = (await admin.get("/api/admin/organizations").expect(200))
      .body as {
      organizations: Array<{
        id: string;
        name: string;
        organizationNumber: string;
        registryStatus: string;
        registrySource: string;
        isInternalTenant: boolean;
      }>;
    };
    kfukId = payload.organizations.find((o) =>
      o.name.includes("KFUK-KFUM Norge"),
    )!.id;
    idealId = payload.organizations.find((o) =>
      o.name.includes("Frivillighetens Hus"),
    )!.id;
    expect(
      payload.organizations.find((o) => o.id === idealId)?.registrySource,
    ).toBe("demo_fixture");
    expect(
      payload.organizations.find((o) => o.id === idealId)?.registryStatus,
    ).toBe("verified");
    expect(
      payload.organizations.find((o) => o.id === idealId)?.organizationNumber,
    ).toBe("919181206");
    const rooms = (await request(app).get("/api/rooms").expect(200))
      .body as Array<{
      id: string;
    }>;
    elvebredden = rooms.find((r) => r.id === "elvebredden")!.id;
  });

  it("lists approved orgs for the internal demo persona", async () => {
    const internal = await login("internal");
    const rows = (await internal.get("/api/me/organizations").expect(200))
      .body as Array<{ organization: { id: string } }>;
    expect(rows.some((r) => r.organization.id === kfukId)).toBe(true);
  });

  it("prices KFUK booking as internal via organisation entitlements", async () => {
    const internal = await login("internal");
    const search = {
      roomId: elvebredden,
      date: addDays(today(), 25),
      start: "10:00",
      end: "11:00",
      people: 1,
      organizationId: kfukId,
    };
    const quote = (
      await internal
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    expect(quote.total).toBe(400);
    expect(quote.priceCategory).toBe("internal");
  });

  it("rejects forged organizationId without representation", async () => {
    const external = await login("external");
    await external
      .post("/api/quote")
      .set("Origin", origin)
      .send({
        roomId: elvebredden,
        date: addDays(today(), 26),
        start: "10:00",
        end: "11:00",
        people: 1,
        organizationId: kfukId,
      })
      .expect(403);
  });

  it("verifies fixture org without granting representation", async () => {
    const external = await login("external");
    const org = (
      await external
        .post("/api/organizations/verify")
        .set("Origin", origin)
        .send({ organizationNumber: "871033552" })
        .expect(200)
    ).body;
    expect(org.name).toBe("Norsk Folkehjelp");
    expect(org.registryStatus).toBe("verified");
    expect(org.registrySource).toBe("demo_fixture");
    const mine = (await external.get("/api/me/organizations").expect(200))
      .body as unknown[];
    expect(mine).toEqual([]);
  });

  it("idempotent verify does not duplicate organisations", async () => {
    const admin = await login("admin");
    const before = (await admin.get("/api/admin/organizations").expect(200))
      .body.organizations.length;
    const agent = await login("external");
    await agent
      .post("/api/organizations/verify")
      .set("Origin", origin)
      .send({ organizationNumber: "871033552" })
      .expect(200);
    await agent
      .post("/api/organizations/verify")
      .set("Origin", origin)
      .send({ organizationNumber: "871 033 552" })
      .expect(200);
    const after = (await admin.get("/api/admin/organizations").expect(200)).body
      .organizations.length;
    expect(after).toBe(before);
  });

  it("pending representant does not get ideal price; approve then revoke updates quote", async () => {
    const external = await login("external");
    await external
      .post("/api/organizations/represent")
      .set("Origin", origin)
      .send({ organizationId: idealId })
      .expect(201);
    await external
      .post("/api/quote")
      .set("Origin", origin)
      .send({
        roomId: elvebredden,
        date: addDays(today(), 27),
        start: "10:00",
        end: "11:00",
        people: 1,
        organizationId: idealId,
      })
      .expect(403);

    const admin = await login("admin");
    const payload = (await admin.get("/api/admin/organizations").expect(200))
      .body as {
      memberships: Array<{
        id: string;
        userId: string;
        organizationId: string;
      }>;
      requests: Array<{ id: string; email: string; organizationId?: string }>;
    };
    const req = payload.requests.find(
      (r) =>
        r.email === "ekstern@example.invalid" && r.organizationId === idealId,
    );
    expect(req).toBeTruthy();
    await admin
      .patch(`/api/admin/membership-requests/${req!.id}`)
      .set("Origin", origin)
      .send({ status: "approved" })
      .expect(200);

    const quote = (
      await external
        .post("/api/quote")
        .set("Origin", origin)
        .send({
          roomId: elvebredden,
          date: addDays(today(), 27),
          start: "10:00",
          end: "11:00",
          people: 1,
          organizationId: idealId,
        })
        .expect(200)
    ).body;
    expect(quote.total).toBe(560);
    expect(quote.priceCategory).toBe("ideal");

    const membership = payload.memberships.find(
      (m) => m.userId === "demo-external" && m.organizationId === idealId,
    );
    // Reload memberships after approve
    const afterApprove = (
      await admin.get("/api/admin/organizations").expect(200)
    ).body as {
      memberships: Array<{
        id: string;
        userId: string;
        organizationId: string;
      }>;
    };
    const mem = afterApprove.memberships.find(
      (m) => m.userId === "demo-external" && m.organizationId === idealId,
    );
    expect(mem || membership).toBeTruthy();
    await admin
      .patch(`/api/admin/memberships/${mem!.id}`)
      .set("Origin", origin)
      .send({ status: "revoked" })
      .expect(200);

    await external
      .post("/api/quote")
      .set("Origin", origin)
      .send({
        roomId: elvebredden,
        date: addDays(today(), 27),
        start: "10:00",
        end: "11:00",
        people: 1,
        organizationId: idealId,
      })
      .expect(403);
  });

  it("fixture not-registered org does not auto-qualify as ideal", async () => {
    const external = await login("external");
    const org = (
      await external
        .post("/api/organizations/verify")
        .set("Origin", origin)
        .send({ organizationNumber: "999999999" })
        .expect(200)
    ).body;
    expect(org.registryStatus).toBe("not_registered");
  });

  it("manual ideal does not overwrite registry snapshot source", async () => {
    const admin = await login("admin");
    const before = (
      await admin.get("/api/admin/organizations").expect(200)
    ).body.organizations.find((o: { id: string }) => o.id === idealId) as {
      registryStatus: string;
      registrySource: string;
      registrySnapshot?: string;
    };
    await admin
      .post(`/api/admin/organizations/${idealId}/manual-ideal`)
      .set("Origin", origin)
      .send({ eligible: true })
      .expect(200);
    const after = (
      await admin.get("/api/admin/organizations").expect(200)
    ).body.organizations.find((o: { id: string }) => o.id === idealId) as {
      registryStatus: string;
      registrySource: string;
      registrySnapshot?: string;
      manualIdealEligible: boolean;
    };
    expect(after.manualIdealEligible).toBe(true);
    expect(after.registryStatus).toBe(before.registryStatus);
    expect(after.registrySource).toBe(before.registrySource);
    expect(after.registrySnapshot).toBe(before.registrySnapshot);
  });

  it("books on behalf of KFUK with matching quote", async () => {
    const internal = await login("internal");
    const search = {
      roomId: elvebredden,
      date: addDays(today(), 28),
      start: "13:00",
      end: "14:00",
      people: 1,
      organizationId: kfukId,
    };
    const quote = (
      await internal
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    const booking = (
      await internal
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...search,
          title: "Org booking",
          notes: "",
          name: "Intern bruker",
          email: "intern@example.invalid",
          phone: "90000000",
          quoteToken: quote.token,
          acceptedTerms: true,
        })
        .expect(201)
    ).body;
    expect(booking.totalPrice).toBe(400);
  });
});
