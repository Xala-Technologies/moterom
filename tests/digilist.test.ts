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
    getFunctionName(ref) === "domain/resources:getBySlugPublic"
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
});
