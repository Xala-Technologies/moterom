import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Response as ExpressResponse } from "express";
import { randomUUID } from "node:crypto";
import { getFunctionName } from "convex/server";
import { addDays, interval, today } from "../shared/time";
import { AppError } from "../shared/validation";

process.env.DATA_MODE = "live";
process.env.DIGILIST_URL = "https://example.convex.cloud";
process.env.DIGILIST_HTTP_URL = "https://api.example.test";
process.env.DIGILIST_TENANT_ID = "building-test";
process.env.BOOKING_ACCESS = "members";
process.env.ADMIN_EMAILS = "admin@example.invalid";
process.env.ACCESS_REQUESTS_DB_PATH = ":memory:";
process.env.PUBLIC_ORIGIN = "http://localhost:4173";
process.env.SESSION_SECRET = "test-only-secret-that-is-not-a-production-secret";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  liveUser: vi.fn(),
  refreshAccess: vi.fn(),
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.query;
    mutation = mocks.mutation;
    setAuth() {}
  },
}));
vi.mock("../server/digilist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/digilist")>()),
  liveUser: mocks.liveUser,
  refreshAccess: mocks.refreshAccess,
}));

const { app } = await import("../server/app");
const { writeSession } = await import("../server/session");
const { inventory } = await import("../server/config");
const origin = "http://localhost:4173";
const member = {
  id: "member-1",
  name: "Kari",
  email: "kari@example.invalid",
  isAdmin: false,
  isMember: true,
};
const admin = {
  ...member,
  id: "admin-1",
  email: "admin@example.invalid",
  isAdmin: true,
};
const outsider = {
  ...member,
  id: "outsider-1",
  email: "outsider@example.invalid",
  isMember: false,
};
let records: Record<string, any>[];
let sources: Record<string, any>[];
let tenantMembers: Record<string, any>[];

async function cookie(token = "member") {
  let value = "";
  await writeSession(
    {
      cookie(name: string, content: string) {
        value = `${name}=${content}`;
      },
    } as unknown as ExpressResponse,
    { token, accessToken: "convex-jwt", expiresAt: Date.now() + 3600000 },
  );
  return value;
}
const input = () => ({
  roomId: inventory[0].id,
  date: addDays(today(), 10),
  start: "09:00",
  end: "10:00",
  people: 2,
  title: "Teammøte",
  notes: "Agenda",
  name: member.name,
  email: member.email,
  phone: "41234567",
});
async function quote(body = input()) {
  return (
    await request(app)
      .post("/api/quote")
      .set("Origin", origin)
      .set("Cookie", await cookie())
      .send(body)
      .expect(200)
  ).body.token as string;
}
async function submit(
  body: Record<string, unknown>,
  key: string,
  expected: number,
) {
  return request(app)
    .post("/api/bookings")
    .set("Origin", origin)
    .set("Cookie", await cookie())
    .set("Idempotency-Key", key)
    .send(body)
    .expect(expected);
}
beforeEach(() => {
  vi.clearAllMocks();
  records = [];
  tenantMembers = [];
  sources = inventory.map((room) => ({
    _id: `resource-${room.id}`,
    tenantId: "building-test",
    name: room.name,
    slug: room.slug,
    capacity: room.capacity,
    accessChannel: "tenant_portal",
    visibility: "private",
    requiresApproval: false,
    bookingConfig: { approvalRequired: false, minBookingDurationMinutes: 60 },
    metadata: { unrelated: "keep" },
    images: [],
    amenities: [],
  }));
  mocks.liveUser.mockImplementation(async (session) =>
    session.token === "admin"
      ? admin
      : session.token === "outsider"
        ? outsider
        : member,
  );
  mocks.refreshAccess.mockResolvedValue(false);
  mocks.query.mockImplementation(async (ref, args) => {
    switch (getFunctionName(ref)) {
      case "domain/resources:getBySlug":
        return sources.find((room) => room.slug === args.slug);
      case "domain/bookings:listMine":
        return records.filter((b) => b.userId === args.userId);
      case "domain/bookings:get":
        return records.find((b) => b._id === args.id);
      case "domain/bookings:validateBookingSlot":
        return {
          valid: !records.some(
            (b) =>
              b.resourceId === args.resourceId &&
              b.startTime < args.endTime &&
              b.endTime > args.startTime,
          ),
        };
      case "domain/pricing:quote":
        return { summary: { total: 0 }, currency: "NOK", validation: [] };
      case "domain/tenantTeam:listMembers":
        return tenantMembers;
      default:
        throw new Error(`Unexpected query ${getFunctionName(ref)}`);
    }
  });
  mocks.mutation.mockImplementation(async (ref, args) => {
    switch (getFunctionName(ref)) {
      case "domain/bookings:create": {
        const b = {
          ...args,
          _id: randomUUID(),
          status: "confirmed",
          totalPrice: 0,
          userName: member.name,
          userEmail: member.email,
        };
        records.push(b);
        return { id: b._id };
      }
      case "domain/resources:update": {
        Object.assign(
          sources.find((room) => room._id === args.id)!,
          args,
        );
        return {};
      }
      default:
        throw new Error(`Unexpected mutation ${getFunctionName(ref)}`);
    }
  });
});

describe("live-mode BFF with mocked Digilist contracts (no live writes)", () => {
  it("recovers the original booking before occupied-slot or quote checks; rejects changed retries", async () => {
    const body = { ...input(), quoteToken: await quote() };
    const key = randomUUID();
    const first = await submit(body, key, 201);
    const again = await submit(
      { ...body, quoteToken: "expired-token" },
      key,
      201,
    );
    expect(again.body.id).toBe(first.body.id);
    expect(again.body.phone).toBe(body.phone);
    await submit({ ...body, people: 3 }, key, 409);
    await submit({ ...body, title: "Different purpose" }, key, 409);
    await submit({ ...body, roomId: inventory[1].id }, key, 409);
    expect(records).toHaveLength(1);
    expect(
      mocks.mutation.mock.calls.filter(
        ([ref]) => getFunctionName(ref) === "domain/bookings:create",
      ),
    ).toHaveLength(1);
    expect(records[0]).toMatchObject({
      tenantId: "building-test",
      userId: member.id,
      resourceId: `resource-${inventory[0].id}`,
    });
    await submit({ ...body, quoteToken: "expired-token" }, randomUUID(), 409);
  });

  it("reconciles a committed mutation whose response was lost without another write", async () => {
    const body = { ...input(), quoteToken: await quote() };
    mocks.mutation.mockImplementationOnce(async (_ref, args) => {
      records.push({
        ...args,
        _id: "committed",
        status: "confirmed",
        totalPrice: 0,
      });
      throw new Error("response lost after commit");
    });
    const result = await submit(body, randomUUID(), 201);
    expect(result.body.id).toBe("committed");
    expect(mocks.mutation).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a retry record belonging to another tenant", async () => {
    const body = { ...input(), quoteToken: await quote() };
    const key = randomUUID();
    await submit(body, key, 201);
    records[0].tenantId = "other-building";
    // Even a buggy upstream list returning another tenant must not leak it.
    const response = await submit(
      { ...body, quoteToken: "expired-token" },
      key,
      409,
    );
    expect(response.body.code).toBe("quote_expired");
    expect(response.body.id).toBeUndefined();
  });

  it("keeps quotes and bookings unavailable when Digilist fails or requires payment", async () => {
    const baseQuery = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (ref, args) =>
      getFunctionName(ref) === "domain/pricing:quote"
        ? { summary: { total: 100 }, currency: "NOK", validation: [] }
        : baseQuery(ref, args),
    );
    const paid = await request(app)
      .post("/api/quote")
      .set("Origin", origin)
      .set("Cookie", await cookie())
      .send(input())
      .expect(409);
    expect(paid.body.code).toBe("skb_internal_booking_only");
    mocks.query.mockRejectedValue(new Error("upstream unavailable"));
    await request(app)
      .get("/api/rooms")
      .set("Cookie", await cookie())
      .expect(502);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("scopes card availability to one resource and shares room reads within the request", async () => {
    const response = await request(app)
      .get("/api/availability/slots")
      .set("Cookie", await cookie())
      .query({ date: input().date, roomId: inventory[0].id })
      .expect(200);
    expect(response.body).toHaveLength(9);
    const resources = mocks.query.mock.calls.filter(
      ([ref]) => getFunctionName(ref) === "domain/resources:getBySlug",
    );
    const slots = mocks.query.mock.calls.filter(
      ([ref]) => getFunctionName(ref) === "domain/bookings:validateBookingSlot",
    );
    expect(resources).toHaveLength(1);
    expect(slots).toHaveLength(9);
    expect(
      slots.every(
        ([, args]) => args.resourceId === `resource-${inventory[0].id}`,
      ),
    ).toBe(true);
  });

  it("saves bilingual room copy and image provenance through Digilist, surviving a fresh request", async () => {
    const patch = {
      name: "Sauda 1",
      capacity: 12,
      description: "Oppdatert",
      descriptionEn: "Updated",
      capacityLabel: "12 personer",
      capacityLabelEn: "12 people",
      requiresApproval: true,
      image: "https://images.example.invalid/room.webp",
      imageKind: "illustrative",
      amenities: ["Skjerm"],
      arrivalInfo: "Resepsjonen",
    };
    await request(app)
      .patch(`/api/admin/rooms/${inventory[0].id}`)
      .set("Origin", origin)
      .set("Cookie", await cookie("admin"))
      .send(patch)
      .expect(200);
    const rooms = (
      await request(app)
        .get("/api/rooms")
        .set("Cookie", await cookie())
        .expect(200)
    ).body;
    expect(rooms[0]).toMatchObject(patch);
    expect(sources[0].metadata.unrelated).toBe("keep");
    expect(sources[0].bookingConfig.minBookingDurationMinutes).toBe(60);
    expect(sources[0]).toMatchObject({
      visibility: "private",
      accessChannel: "tenant_portal",
      tenantId: "building-test",
    });
    await request(app)
      .patch(`/api/admin/rooms/${inventory[0].id}`)
      .set("Origin", origin)
      .set("Cookie", await cookie())
      .send(patch)
      .expect(403);
  });

  it("requires Digilist membership before completing an access request and honors revocation", async () => {
    const created = (
      await request(app)
        .post("/api/access-requests")
        .set("Origin", origin)
        .set("Cookie", await cookie("outsider"))
        .send({
          name: "Spoofed",
          email: "other@example.invalid",
          message: "Please add me",
        })
        .expect(201)
    ).body;
    expect(created.email).toBe(outsider.email);
    await request(app)
      .patch(`/api/admin/access-requests/${created.id}`)
      .set("Origin", origin)
      .set("Cookie", await cookie("admin"))
      .send({ status: "approved" })
      .expect(409);
    tenantMembers.push({
      userId: outsider.id,
      name: outsider.name,
      email: outsider.email,
      role: "support",
      status: "active",
    });
    await request(app)
      .patch(`/api/admin/access-requests/${created.id}`)
      .set("Origin", origin)
      .set("Cookie", await cookie("admin"))
      .send({ status: "approved" })
      .expect(200);
    // Historical local approval cannot override Digilist's current denial.
    await request(app)
      .get("/api/rooms")
      .set("Cookie", await cookie("outsider"))
      .expect(403);
    const session = await request(app)
      .get("/api/session")
      .set("Cookie", await cookie("outsider"))
      .expect(200);
    expect(session.body.user.isMember).toBe(false);
    mocks.refreshAccess.mockRejectedValue(
      new AppError(503, "temporary failure"),
    );
    const fallback = await request(app)
      .get("/api/session")
      .set("Cookie", await cookie("outsider"))
      .expect(200);
    expect(fallback.body.user.isMember).toBe(false);
  });

  it("pins the member list to the building and denies customers and anonymous callers", async () => {
    await request(app).get("/api/admin/members").expect(401);
    await request(app)
      .get("/api/admin/members")
      .set("Cookie", await cookie())
      .expect(403);
    await request(app)
      .get("/api/admin/members")
      .set("Cookie", await cookie("admin"))
      .expect(200);
    const call = mocks.query.mock.calls.find(
      ([ref]) => getFunctionName(ref) === "domain/tenantTeam:listMembers",
    );
    expect(call?.[1]).toEqual({ tenantId: "building-test", actorId: admin.id });
  });
});
