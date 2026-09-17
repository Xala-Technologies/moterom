import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccessRequestStore } from "../server/accessRequests";
import { AppError } from "../shared/validation";

describe("access request store", () => {
  let store: AccessRequestStore;
  beforeEach(() => {
    store = new AccessRequestStore(":memory:");
  });
  afterEach(() => store.db.close());

  it("creates, lists and updates status without granting membership", () => {
    const created = store.create({
      name: "Ola Nordmann",
      email: "ola@example.invalid",
      message: "Trenger tilgang til møterom",
      userId: "user-1",
    });
    expect(created.status).toBe("pending");
    expect(created.email).toBe("ola@example.invalid");
    expect(store.list()).toHaveLength(1);

    const approved = store.updateStatus(created.id, "approved");
    expect(approved.status).toBe("approved");
    expect(approved.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
  });

  it("returns the existing pending request for the same email", () => {
    const first = store.create({
      name: "Ola",
      email: "ola@example.invalid",
      message: "Første",
    });
    const second = store.create({
      name: "Ola Nordmann",
      email: "OLA@example.invalid",
      message: "Andre",
    });
    expect(second.id).toBe(first.id);
    expect(store.list()).toHaveLength(1);
  });

  it("throws when updating a missing request", () => {
    expect(() => store.updateStatus("missing", "rejected")).toThrow(AppError);
  });
});
