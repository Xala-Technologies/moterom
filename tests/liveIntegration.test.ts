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
process.env.PORTAL_ROLES_DB_PATH = ":memory:";
process.env.MESSAGING_LOCAL_DB_PATH = ":memory:";
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
  tenantRole: "tenant_admin",
  adminAccess: "full" as const,
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
let conversations: Record<string, any>[];
let messages: Record<string, any>[];

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
  conversations = [];
  messages = [];
  sources = inventory.map((room) => ({
    _id: `resource-${room.id}`,
    tenantId: "building-test",
    name: room.name,
    slug: room.slug,
    capacity: room.capacity,
    status: "published",
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
      case "domain/resources:list":
        return sources;
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
      case "domain/messaging:listConversations":
        return conversations.filter((c) => c.userId === args.userId);
      case "domain/messaging:listConversationsForTenant":
        return conversations.filter((c) => c.tenantId === args.tenantId);
      case "domain/messaging:getConversationByBooking":
        return (
          conversations.find((c) => c.bookingId === args.bookingId) ?? null
        );
      case "domain/messaging:getConversation":
        return conversations.find((c) => c._id === args.id);
      case "domain/messaging:listMessages":
        return messages.filter((m) => m.conversationId === args.conversationId);
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
      case "domain/messaging:getOrCreateConversationForBooking": {
        const existing = conversations.find(
          (c) => c.bookingId === args.bookingId,
        );
        if (existing) return { conversationId: existing._id };
        const conversation = {
          _id: randomUUID(),
          tenantId: args.tenantId,
          bookingId: args.bookingId,
          userId: args.userId,
          resourceId: args.resourceId,
          listingName: inventory[0].name,
          userName: member.name,
          lastMessagePreview: "",
          unreadCount: 0,
        };
        conversations.push(conversation);
        return { conversationId: conversation._id };
      }
      case "domain/messaging:sendMessage": {
        const replayed = messages.find(
          (m) =>
            m.conversationId === args.conversationId &&
            m.clientMessageId &&
            m.clientMessageId === args.clientMessageId,
        );
        if (replayed) return { replayed: true, id: replayed._id };
        const message = {
          _id: randomUUID(),
          conversationId: args.conversationId,
          senderId: args.senderId,
          senderType: args.senderType,
          senderName:
            args.senderType === "admin" ? "Administrator" : member.name,
          content: args.content,
          visibility: "public",
          _creationTime: Date.now(),
          clientMessageId: args.clientMessageId,
        };
        messages.push(message);
        const conversation = conversations.find(
          (c) => c._id === args.conversationId,
        );
        if (conversation) {
          conversation.lastMessagePreview = args.content;
          conversation.lastMessageAt = message._creationTime;
        }
        return { id: message._id };
      }
      case "domain/messaging:markMessagesAsRead":
        return {};
      case "domain/tenantTeam:ensureActiveBooker": {
        const email = String(args.email).trim().toLowerCase();
        if (
          !tenantMembers.some(
            (member) =>
              member.email.trim().toLowerCase() === email &&
              member.status === "active",
          )
        ) {
          tenantMembers.push({
            userId: randomUUID(),
            name: args.name || email,
            email,
            role: "support",
            status: "active",
          });
        }
        return {
          userId: randomUUID(),
          membershipId: randomUUID(),
          createdNewUser: true,
          activated: true,
        };
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
    mocks.query.mockImplementation(async (ref, args) =>
      getFunctionName(ref) === "domain/pricing:quote"
        ? {
            summary: { total: 0 },
            currency: "NOK",
            validation: [
              {
                severity: "error",
                code: "NO_PRICING_CONFIGURED",
                message: "Ingen priskonfigurasjon funnet",
              },
            ],
          }
        : baseQuery(ref, args),
    );
    const missingPrice = await request(app)
      .post("/api/quote")
      .set("Origin", origin)
      .set("Cookie", await cookie())
      .send(input())
      .expect(409);
    expect(missingPrice.body.code).toBe("quote_rejected");
    expect(missingPrice.body.message).toBe("Ingen priskonfigurasjon funnet");
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

  it("sends a booking message through Digilist messaging facades", async () => {
    const created = await submit(
      { ...input(), quoteToken: await quote() },
      randomUUID(),
      201,
    );
    const sent = await request(app)
      .post(`/api/bookings/${created.body.id}/messages`)
      .set("Origin", origin)
      .set("Cookie", await cookie())
      .send({ content: "Hei admin", clientMessageId: randomUUID() })
      .expect(201);
    expect(sent.body.messages[0].content).toBe("Hei admin");
    expect(sent.body.messages[0].fromAdmin).toBe(false);
    const inbox = await request(app)
      .get("/api/admin/messages")
      .set("Cookie", await cookie("admin"))
      .expect(200);
    expect(inbox.body[0].preview).toBe("Hei admin");
    await request(app)
      .get("/api/admin/messages")
      .set("Cookie", await cookie())
      .expect(403);
  });

  it("activates a Digilist portal booker when completing an access request", async () => {
    const created = (
      await request(app)
        .post("/api/access-requests")
        .set("Origin", origin)
        .set("Cookie", await cookie("outsider"))
        .send({
          name: "Spoofed",
          email: "other@example.invalid",
          company: "Eksempel AS",
        })
        .expect(201)
    ).body;
    expect(created.email).toBe(outsider.email);
    await request(app)
      .patch(`/api/admin/access-requests/${created.id}`)
      .set("Origin", origin)
      .set("Cookie", await cookie("admin"))
      .send({ status: "approved" })
      .expect(200);
    expect(
      mocks.mutation.mock.calls.some(
        ([ref]) =>
          getFunctionName(ref) === "domain/tenantTeam:ensureActiveBooker",
      ),
    ).toBe(true);
    expect(
      mocks.mutation.mock.calls.some(
        ([ref]) => getFunctionName(ref) === "domain/tenantTeam:inviteMember",
      ),
    ).toBe(false);
    // Inbox completion does not override the current Digilist session.
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

  it("keeps the access request open when Digilist cannot activate the booker", async () => {
    const created = (
      await request(app)
        .post("/api/access-requests")
        .set("Origin", origin)
        .set("Cookie", await cookie("outsider"))
        .send({
          name: "Outsider",
          email: outsider.email,
          company: "Eksempel AS",
        })
        .expect(201)
    ).body;
    mocks.mutation.mockImplementationOnce(async () => {
      throw new Error("activation failed");
    });
    await request(app)
      .patch(`/api/admin/access-requests/${created.id}`)
      .set("Origin", origin)
      .set("Cookie", await cookie("admin"))
      .send({ status: "approved" })
      .expect(409);
    const rows = await request(app)
      .get("/api/admin/access-requests")
      .set("Cookie", await cookie("admin"))
      .expect(200);
    expect(
      rows.body.find((row: { id: string }) => row.id === created.id).status,
    ).toBe("pending");
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

  it("returns one professional row per building member", async () => {
    tenantMembers = [
      {
        userId: "dev-admin",
        name: "SKB DEV Admin",
        email: "skb.admin@digilist.dev",
        role: "tenant_admin",
        status: "active",
      },
      {
        userId: "dup-invited",
        name: "LIJSERIBST",
        email: "burnerlbv12@gmail.com",
        role: "support",
        status: "invited",
      },
      {
        userId: "dup-active",
        name: "LIJSERIBST",
        email: "burnerlbv12@gmail.com",
        role: "support",
        status: "active",
      },
      {
        userId: "admin-row",
        name: "SKB allowlist admin",
        email: "skb@digilist.no",
        role: "tenant_admin",
        status: "active",
      },
    ];
    const body = (
      await request(app)
        .get("/api/admin/members")
        .set("Cookie", await cookie("admin"))
        .expect(200)
    ).body;
    expect(body.map((row: { email: string }) => row.email)).toEqual([
      "skb@digilist.no",
      "burnerlbv12@gmail.com",
    ]);
    expect(body[1].userId).toBe("dup-active");
  });
});
