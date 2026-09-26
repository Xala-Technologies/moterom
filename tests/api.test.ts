import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { addDays, interval, today } from "../shared/time";
process.env.DATA_MODE = "demo";
process.env.DEMO_DB_PATH = ":memory:";
process.env.ACCESS_REQUESTS_DB_PATH = ":memory:";
process.env.MESSAGING_LOCAL_DB_PATH = ":memory:";
process.env.PORTAL_ROLES_DB_PATH = ":memory:";
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
  it("lets a customer quote and book a multi-hour interval", async () => {
    const search = {
      roomId,
      date: addDays(today(), 19),
      start: "10:00",
      end: "13:00",
      people: 2,
    };
    const quote = (
      await customer
        .post("/api/quote")
        .set("Origin", origin)
        .send(search)
        .expect(200)
    ).body;
    const created = (
      await customer
        .post("/api/bookings")
        .set("Origin", origin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...search,
          title: "Halvdagsmøte",
          notes: "",
          quoteToken: quote.token,
          ...contact,
        })
        .expect(201)
    ).body;
    const span = interval(search);
    expect(created.startTime).toBe(span.startTime);
    expect(created.endTime).toBe(span.endTime);
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
    expect(Array.isArray(insights.body.companies)).toBe(true);
    expect(JSON.stringify(insights.body)).not.toMatch(/@/);
    await administrator
      .get("/api/admin/insights")
      .query({ rom: "does-not-exist" })
      .expect(400);
    await administrator
      .get("/api/admin/insights/rooms/does-not-exist")
      .expect(404);
  });
  it("lets admins draft, publish and create rooms in the portal catalogue", async () => {
    const target = (await administrator.get("/api/admin").expect(200)).body
      .rooms[2] as { id: string; portalPublished: boolean };
    expect(target.portalPublished).toBe(true);
    await customer
      .post(`/api/admin/rooms/${target.id}/portal`)
      .set("Origin", origin)
      .send({ published: false })
      .expect(403);
    const hidden = (
      await administrator
        .post(`/api/admin/rooms/${target.id}/portal`)
        .set("Origin", origin)
        .send({ published: false })
        .expect(200)
    ).body;
    expect(hidden.portalPublished).toBe(false);
    const catalogue = (await customer.get("/api/rooms").expect(200))
      .body as Array<{ id: string }>;
    expect(catalogue.some((room) => room.id === target.id)).toBe(false);
    const adminRooms = (await administrator.get("/api/admin").expect(200)).body
      .rooms as Array<{ id: string; portalPublished: boolean }>;
    expect(
      adminRooms.find((room) => room.id === target.id)?.portalPublished,
    ).toBe(false);
    await administrator
      .post(`/api/admin/rooms/${target.id}/portal`)
      .set("Origin", origin)
      .send({ published: true })
      .expect(200);
    expect(
      (
        (await customer.get("/api/rooms").expect(200)).body as Array<{
          id: string;
        }>
      ).some((room) => room.id === target.id),
    ).toBe(true);
    const created = (
      await administrator
        .post("/api/admin/rooms")
        .set("Origin", origin)
        .send({
          name: "Nytt møterom",
          capacity: 6,
          description: "Opprettet i test",
          descriptionEn: "Created in test",
          capacityLabel: "6 personer",
          capacityLabelEn: "6 people",
          requiresApproval: false,
          amenities: ["Projektor"],
          arrivalInfo: "Resepsjonen",
        })
        .expect(201)
    ).body as {
      id: string;
      portalPublished: boolean;
      name: string;
      descriptionEn: string;
      amenities: string[];
      arrivalInfo?: string;
    };
    expect(created.name).toBe("Nytt møterom");
    expect(created.portalPublished).toBe(false);
    expect(created.descriptionEn).toBe("Created in test");
    expect(created.amenities).toEqual(["Projektor"]);
    expect(created.arrivalInfo).toBe("Resepsjonen");
    expect(
      (
        (await customer.get("/api/rooms").expect(200)).body as Array<{
          id: string;
        }>
      ).some((room) => room.id === created.id),
    ).toBe(false);
    const jpegBase64 = Buffer.alloc(50_000, 0xff).toString("base64");
    expect(
      Buffer.byteLength(JSON.stringify({ data: jpegBase64 })),
    ).toBeGreaterThan(32_768);
    const withPhoto = (
      await administrator
        .post("/api/admin/rooms")
        .set("Origin", origin)
        .send({
          name: "Rom med bilde",
          capacity: 4,
          description: "Med opplastet bilde",
          requiresApproval: false,
          imageKind: "illustrative",
          imageFile: {
            filename: "room.jpg",
            contentType: "image/jpeg",
            data: jpegBase64,
          },
        })
        .expect(201)
    ).body as { id: string; image?: string; imageKind?: string };
    expect(withPhoto.imageKind).toBe("illustrative");
    expect(withPhoto.image).toMatch(/^\/rooms\/room-/);
    await administrator
      .delete(`/api/admin/rooms/${withPhoto.id}`)
      .set("Origin", origin)
      .expect(200);
    expect(
      (
        (await administrator.get("/api/admin").expect(200)).body as {
          rooms: Array<{ id: string }>;
        }
      ).rooms.some((room) => room.id === withPhoto.id),
    ).toBe(false);
    await administrator
      .post(`/api/admin/rooms/${created.id}/portal`)
      .set("Origin", origin)
      .send({ published: true })
      .expect(200);
    expect(
      (
        (await customer.get("/api/rooms").expect(200)).body as Array<{
          id: string;
        }>
      ).some((room) => room.id === created.id),
    ).toBe(true);
  });
  it("lets a customer message the administrator and shows the thread in both inboxes", async () => {
    const bookings = (await customer.get("/api/bookings").expect(200)).body as {
      id: string;
      userId: string;
    }[];
    const mine = bookings.find((b) => b.userId === "demo-customer");
    expect(mine).toBeTruthy();
    const empty = await customer
      .get(`/api/bookings/${mine!.id}/messages`)
      .expect(200);
    expect(empty.body.messages).toEqual([]);
    const sent = await customer
      .post(`/api/bookings/${mine!.id}/messages`)
      .set("Origin", origin)
      .send({ content: "Trenger adgangskort", clientMessageId: randomUUID() })
      .expect(201);
    expect(sent.body.messages).toHaveLength(1);
    expect(sent.body.messages[0].content).toBe("Trenger adgangskort");
    expect(sent.body.messages[0].fromAdmin).toBe(false);
    const inbox = await administrator.get("/api/admin/messages").expect(200);
    expect(inbox.body[0].preview).toBe("Trenger adgangskort");
    const reply = await administrator
      .post(`/api/admin/messages/${inbox.body[0].id}`)
      .set("Origin", origin)
      .send({ content: "Kort ligger i resepsjonen" })
      .expect(201);
    expect(reply.body.messages).toHaveLength(2);
    expect(reply.body.messages[1].fromAdmin).toBe(true);
    const thread = await customer
      .get(`/api/bookings/${mine!.id}/messages`)
      .expect(200);
    expect(
      thread.body.messages.map((m: { content: string }) => m.content),
    ).toEqual(["Trenger adgangskort", "Kort ligger i resepsjonen"]);
    await customer.get("/api/admin/messages").expect(403);
  });
  it("opens a general support thread and blocks cross-customer access", async () => {
    const opened = await customer
      .post("/api/messages/support")
      .set("Origin", origin)
      .send({
        content: "Nettsiden laster sakte",
        clientMessageId: randomUUID(),
      })
      .expect(201);
    expect(opened.body.conversation.kind).toBe("support");
    expect(opened.body.messages).toHaveLength(1);
    const supportId = opened.body.conversation.id as string;
    expect(supportId.startsWith("sup_")).toBe(true);
    const inbox = await administrator.get("/api/admin/messages").expect(200);
    expect(
      inbox.body.some(
        (row: { id: string; kind: string }) =>
          row.id === supportId && row.kind === "support",
      ),
    ).toBe(true);
    const reply = await administrator
      .post(`/api/admin/messages/${supportId}`)
      .set("Origin", origin)
      .send({ content: "Takk, vi ser på det." })
      .expect(201);
    expect(reply.body.messages).toHaveLength(2);
    await request(app).get(`/api/messages/${supportId}`).expect(401);
    expect(opened.body.conversation.customerId).toBe("demo-customer");
    const again = await customer
      .post("/api/messages/support")
      .set("Origin", origin)
      .send({})
      .expect(200);
    expect(again.body.conversation.id).toBe(supportId);
  });
  it("lets an administrator delete support and booking conversations", async () => {
    const opened = await customer
      .post("/api/messages/support")
      .set("Origin", origin)
      .send({
        content: "Slett denne støttesamtalen",
        clientMessageId: randomUUID(),
      })
      .expect(201);
    const supportId = opened.body.conversation.id as string;
    await customer
      .delete(`/api/admin/messages/${supportId}`)
      .set("Origin", origin)
      .expect(403);
    await administrator
      .delete(`/api/admin/messages/${supportId}`)
      .set("Origin", origin)
      .expect(200);
    await administrator.get(`/api/admin/messages/${supportId}`).expect(404);
    const afterSupport = await administrator
      .get("/api/admin/messages")
      .expect(200);
    expect(
      afterSupport.body.some((row: { id: string }) => row.id === supportId),
    ).toBe(false);

    const bookings = (await customer.get("/api/bookings").expect(200)).body as {
      id: string;
      userId: string;
    }[];
    const mine = bookings.find((b) => b.userId === "demo-customer");
    expect(mine).toBeTruthy();
    const sent = await customer
      .post(`/api/bookings/${mine!.id}/messages`)
      .set("Origin", origin)
      .send({
        content: "Slett booking-samtalen",
        clientMessageId: randomUUID(),
      })
      .expect(201);
    const bookingConversationId = sent.body.conversation.id as string;
    await administrator
      .delete(`/api/admin/messages/${bookingConversationId}`)
      .set("Origin", origin)
      .expect(200);
    const inbox = await administrator.get("/api/admin/messages").expect(200);
    expect(
      inbox.body.some(
        (row: { id: string }) => row.id === bookingConversationId,
      ),
    ).toBe(false);
    await administrator
      .get(`/api/admin/messages/${bookingConversationId}`)
      .expect(404);
  });
  it("publishes a building announcement for members and skips admins", async () => {
    await administrator
      .post("/api/admin/announcements")
      .set("Origin", origin)
      .send({
        title: "Vedlikehold i morgen",
        body: "Heisen er stengt mellom 09 og 11.",
      })
      .expect(201);
    expect((await administrator.get("/api/announcements/active")).body).toBe(
      null,
    );
    const active = await customer.get("/api/announcements/active").expect(200);
    expect(active.body.title).toBe("Vedlikehold i morgen");
    await customer
      .post(`/api/announcements/${active.body.id}/dismiss`)
      .set("Origin", origin)
      .send({})
      .expect(200);
    expect((await customer.get("/api/announcements/active")).body).toBe(null);
  });
  it("includes room context on booking message threads", async () => {
    const bookings = (await customer.get("/api/bookings").expect(200)).body as {
      id: string;
      userId: string;
      roomId: string;
    }[];
    const mine = bookings.find((b) => b.userId === "demo-customer");
    expect(mine).toBeTruthy();
    await customer
      .post(`/api/bookings/${mine!.id}/messages`)
      .set("Origin", origin)
      .send({ content: "Rominfo sjekk", clientMessageId: randomUUID() })
      .expect(201);
    const thread = await customer
      .get(`/api/bookings/${mine!.id}/messages`)
      .expect(200);
    expect(thread.body.conversation.kind).toBe("booking");
    expect(thread.body.conversation.roomId).toBe(mine!.roomId);
    expect(thread.body.conversation.context?.roomId).toBe(mine!.roomId);
    expect(thread.body.conversation.context?.bookingId).toBe(mine!.id);
  });
});
