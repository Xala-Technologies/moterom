import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
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
const { Digilist } = await import("../server/digilist");
const { inventory } = await import("../server/config");
const source = {
  _id: "source-room",
  tenantId: "building-test",
  name: "Sauda",
  capacity: 12,
  requiresApproval: false,
  accessChannel: "tenant_portal",
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
describe("Digilist boundary contracts from the reviewed source", () => {
  it("uses the canonical approvalRequired flag even when the legacy flag is false", async () => {
    expect((await new Digilist().rooms())[0].requiresApproval).toBe(true);
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
});
