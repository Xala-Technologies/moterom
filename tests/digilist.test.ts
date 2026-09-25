import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { addDays, today } from "../shared/time";
process.env.DATA_MODE = "demo";
process.env.DIGILIST_TENANT_ID = "building-test";
const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.query;
    mutation = mocks.mutation;
    setAuth() {}
  },
}));
const { Digilist, setBuildingContext } = await import("../server/digilist");
const { inventory } = await import("../server/config");
const source = {
  _id: "source-room",
  tenantId: "building-test",
  name: "Sauda",
  capacity: 12,
  requiresApproval: false,
  status: "published",
  accessChannel: "tenant_portal",
  visibility: "private",
  bookingConfig: { approvalRequired: true, minBookingDurationMinutes: 60 },
  images: [],
  amenities: [],
};
const user = {
  id: "admin-test",
  name: "Test",
  email: "test@example.invalid",
  isAdmin: true,
  isMember: true,
  tenantRole: "tenant_admin",
  adminAccess: "full" as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockImplementation(async (ref) =>
    getFunctionName(ref) === "domain/resources:getBySlug"
      ? source
      : { valid: true },
  );
  mocks.mutation.mockResolvedValue({});
});
afterEach(() => vi.unstubAllGlobals());
describe("Digilist boundary contracts from the reviewed source", () => {
  it("requires private visibility as well as the tenant-portal channel", async () => {
    mocks.query.mockResolvedValue({ ...source, visibility: "public" });
    await expect(new Digilist().rooms()).rejects.toThrow("ikke tilgjengelig");
  });
  it("does not let legacy metadata override an explicit marketplace channel", async () => {
    mocks.query.mockResolvedValue({
      ...source,
      accessChannel: "marketplace",
      metadata: { accessChannel: "tenant_portal" },
    });
    await expect(new Digilist().rooms()).rejects.toThrow("ikke tilgjengelig");
  });
  it("permits only the explicit non-member tenant-switch error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "access",
          expiresAt: Date.now() + 3600000,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    mocks.mutation.mockRejectedValueOnce(
      new ConvexError({ type: "auth/forbidden_tenant", status: 403 }),
    );
    await expect(
      setBuildingContext({ token: "outsider" }),
    ).resolves.toBeUndefined();
    mocks.mutation.mockRejectedValueOnce(new Error("connection lost"));
    await expect(setBuildingContext({ token: "member" })).rejects.toThrow(
      "connection lost",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("keeps cancellation on the access-token contract required by its REST route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    mocks.query.mockImplementation(async (ref) =>
      getFunctionName(ref).includes("getBySlug")
        ? source
        : {
            _id: "booking-1",
            tenantId: "building-test",
            resourceId: source._id,
            userId: user.id,
            startTime: Date.now() + 86400000,
            endTime: Date.now() + 90000000,
          },
    );
    await new Digilist({
      token: "opaque-session",
      accessToken: "convex-jwt",
    }).updateBooking("booking-1", "cancel", { ...user, isAdmin: false });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer convex-jwt",
    );
  });
  it("preserves photo variants and the gallery on content-only edits", async () => {
    const first = {
      url: "https://images.example.invalid/room.webp",
      variants: { thumb: "thumb.webp" },
    };
    mocks.query.mockResolvedValue({
      ...source,
      images: [first, { url: "https://images.example.invalid/other.webp" }],
    });
    await new Digilist().updateRoom(
      inventory[0].id,
      {
        name: "Sauda",
        capacity: 12,
        description: "Edited",
        requiresApproval: false,
        image: first.url,
        imageKind: "actual",
        descriptionEn: "Updated",
      },
      user,
    );
    expect(mocks.mutation.mock.calls[0][1]).not.toHaveProperty("images");
  });
  it("uses the canonical approvalRequired flag even when the legacy flag is false", async () => {
    expect((await new Digilist().rooms())[0].requiresApproval).toBe(true);
  });
  it("defaults portalPublished from Digilist status and hides drafts", async () => {
    const digilist = new Digilist();
    expect((await digilist.rooms())[0].portalPublished).toBe(true);
    expect((await digilist.allRooms()).length).toBe(inventory.length);
    mocks.query.mockResolvedValue({
      ...source,
      status: "draft",
    });
    const hidden = new Digilist();
    expect(await hidden.rooms()).toEqual([]);
    expect((await hidden.allRooms())[0].portalPublished).toBe(false);
  });
  it("publishes and unpublishes through Digilist lifecycle mutations", async () => {
    await new Digilist().setRoomPortalPublished(inventory[0].id, false, user);
    expect(getFunctionName(mocks.mutation.mock.calls[0][0])).toBe(
      "domain/resources:unpublish",
    );
    expect(mocks.mutation.mock.calls[0][1]).toMatchObject({
      unpublishedBy: user.id,
    });
    mocks.mutation.mockClear();
    mocks.query.mockResolvedValue({ ...source, status: "draft" });
    await new Digilist().setRoomPortalPublished(inventory[0].id, true, user);
    expect(getFunctionName(mocks.mutation.mock.calls[0][0])).toBe(
      "domain/resources:update",
    );
    expect(mocks.mutation.mock.calls[0][1]).toMatchObject({
      updatedBy: user.id,
      status: "published",
    });
  });
  it("archives draft rooms through Digilist update", async () => {
    mocks.query.mockResolvedValue({ ...source, status: "draft" });
    await new Digilist().deleteRoom(inventory[0].id, user);
    expect(getFunctionName(mocks.mutation.mock.calls[0][0])).toBe(
      "domain/resources:update",
    );
    expect(mocks.mutation.mock.calls[0][1]).toMatchObject({
      updatedBy: user.id,
      status: "archived",
    });
  });
  it("refuses deleting a published Digilist room", async () => {
    await expect(
      new Digilist().deleteRoom(inventory[0].id, user),
    ).rejects.toMatchObject({ code: "room_delete_published" });
  });
  it("refuses a room resolved to another building", async () => {
    mocks.query.mockResolvedValue({ ...source, tenantId: "another-building" });
    await expect(new Digilist().rooms()).rejects.toThrow("ikke tilgjengelig");
  });
  it("distinguishes service failure from an unavailable room", async () => {
    const search = {
      date: addDays(today(), 10),
      start: "09:00",
      end: "10:00",
      people: 2,
    };
    mocks.query.mockImplementation(async (ref) => {
      if (getFunctionName(ref).includes("getBySlug")) return source;
      throw new Error("upstream offline");
    });
    expect(
      (await new Digilist().availability(search)).every(
        (r) => r.state === "error",
      ),
    ).toBe(true);
    mocks.query.mockImplementation(async (ref) =>
      getFunctionName(ref).includes("getBySlug")
        ? source
        : { valid: false, reason: "Time slot is blocked" },
    );
    expect(
      (await new Digilist().availability(search)).every(
        (r) => r.state === "unavailable",
      ),
    ).toBe(true);
  });
  it("preserves existing booking rules when changing approval mode", async () => {
    await new Digilist().updateRoom(
      inventory[0].id,
      {
        name: "Sauda",
        capacity: 12,
        description: "Møterom",
        requiresApproval: false,
      },
      user,
    );
    expect(mocks.mutation.mock.calls[0][1]).toMatchObject({
      updatedBy: user.id,
      requiresApproval: false,
      bookingConfig: { approvalRequired: false, minBookingDurationMinutes: 60 },
    });
  });
  it("refuses a marketplace listing even when the tenant matches", async () => {
    mocks.query.mockResolvedValue({ ...source, accessChannel: "marketplace" });
    await expect(new Digilist().rooms()).rejects.toThrow("ikke tilgjengelig");
  });
  it("refuses a paid Digilist quote instead of handing off to app.digilist.no", async () => {
    mocks.query.mockImplementation(async (ref) => {
      const name = getFunctionName(ref);
      if (name.includes("getBySlug")) return source;
      if (name.includes("quote"))
        return { summary: { total: 250 }, currency: "NOK", validation: [] };
      return { valid: true };
    });
    await expect(
      new Digilist().quote(
        inventory[0].id,
        {
          date: addDays(today(), 10),
          start: "09:00",
          end: "10:00",
          people: 2,
        },
        user,
      ),
    ).rejects.toThrow("betaling");
  });
  it("creates via authenticated bookings.create, not guest checkout", async () => {
    mocks.query.mockImplementation(async (ref) => {
      const name = getFunctionName(ref);
      if (name.includes("getBySlug")) return source;
      if (name.includes("validateBookingSlot")) return { valid: true };
      if (name.includes("listMine")) return [];
      return { valid: true };
    });
    mocks.mutation.mockResolvedValue({
      id: "booking-1",
      tenantId: "building-test",
      resourceId: "source-room",
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      startTime: Date.now() + 86400000,
      endTime: Date.now() + 86400000 + 3600000,
      status: "confirmed",
      metadata: {},
    });
    mocks.query.mockImplementation(async (ref) => {
      const name = getFunctionName(ref);
      if (name.includes("getBySlug")) return source;
      if (name.includes("validateBookingSlot")) return { valid: true };
      if (name.includes("listMine")) return [];
      if (name.includes("bookings:get") || name.endsWith(":get"))
        return {
          _id: "booking-1",
          tenantId: "building-test",
          resourceId: "source-room",
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 86400000 + 3600000,
          status: "confirmed",
          metadata: {},
        };
      return { valid: true };
    });
    await new Digilist().create(
      {
        roomId: inventory[0].id,
        date: addDays(today(), 10),
        start: "09:00",
        end: "10:00",
        people: 2,
        name: user.name,
        email: user.email,
        title: "Teammøte",
        notes: "",
        quoteToken: "unused",
      },
      user,
      "11111111-1111-4111-8111-111111111111",
    );
    expect(getFunctionName(mocks.mutation.mock.calls[0][0])).toBe(
      "domain/bookings:create",
    );
    expect(mocks.mutation.mock.calls[0][1]).toMatchObject({
      tenantId: "building-test",
      resourceId: "source-room",
      userId: user.id,
    });
  });
  it("creates a draft portal room without depending on getBySlug", async () => {
    mocks.mutation.mockImplementation(async (ref) => {
      const name = getFunctionName(ref);
      if (name === "domain/resources:create")
        return {
          id: "new-source",
          slug: "nytt-rom-abc",
          name: "Nytt rom",
          capacity: 6,
          status: "draft",
          tenantId: "building-test",
          accessChannel: "tenant_portal",
          visibility: "private",
          requiresApproval: false,
          amenities: ["Skjerm"],
          images: [],
          metadata: {
            moterom: {
              descriptionEn: "New room",
              capacityLabel: "6 personer",
              capacityLabelEn: "6 people",
            },
            arrivalInfo: "Resepsjonen",
          },
        };
      if (name === "domain/pricing:create") return {};
      return {};
    });
    mocks.query.mockRejectedValue(
      new Error("getBySlug should not be required"),
    );
    const room = await new Digilist().createRoom(
      {
        name: "Nytt rom",
        capacity: 6,
        description: "Beskrivelse",
        descriptionEn: "New room",
        capacityLabel: "6 personer",
        capacityLabelEn: "6 people",
        requiresApproval: false,
        amenities: ["Skjerm"],
        arrivalInfo: "Resepsjonen",
      },
      user,
    );
    expect(room.name).toBe("Nytt rom");
    expect(room.portalPublished).toBe(false);
    expect(room.sourceId).toBe("new-source");
    expect(room.amenities).toEqual(["Skjerm"]);
    expect(getFunctionName(mocks.mutation.mock.calls[0][0])).toBe(
      "domain/resources:create",
    );
    expect(mocks.mutation.mock.calls[0][1]).toMatchObject({
      status: "draft",
      accessChannel: "tenant_portal",
      visibility: "private",
      capacity: 6,
    });
  });
  it("surfaces Digilist create failures instead of a generic incomplete error", async () => {
    mocks.mutation.mockRejectedValueOnce(
      new ConvexError({
        type: "ArgumentValidationError",
        message: "Invalid slug",
      }),
    );
    await expect(
      new Digilist().createRoom(
        {
          name: "Nytt rom",
          capacity: 6,
          description: "Beskrivelse",
          requiresApproval: false,
        },
        user,
      ),
    ).rejects.toMatchObject({
      code: "room_create_failed",
      message: "Invalid slug",
    });
  });
});
