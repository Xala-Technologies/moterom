import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccessRequestStore } from "../server/accessRequests";
import { AppError } from "../shared/validation";

describe("access request store", () => {
  let store: AccessRequestStore;
  beforeEach(() => {
    store = new AccessRequestStore(":memory:");
  });
  afterEach(() => store.db.close());

  it("creates, lists and updates status", () => {
    const created = store.create({
      name: "Ola Nordmann",
      email: "ola@example.invalid",
      company: "Testfirma AS",
      userId: "user-1",
    });
    expect(created.status).toBe("pending");
    expect(created.email).toBe("ola@example.invalid");
    expect(created.company).toBe("Testfirma AS");
    expect(store.list()).toHaveLength(1);
    expect(store.hasApproved("ola@example.invalid")).toBe(false);

    const approved = store.updateStatus(created.id, "approved");
    expect(approved.status).toBe("approved");
    expect(approved.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
    expect(store.hasApproved("ola@example.invalid")).toBe(true);
    expect(store.hasApproved("OLA@example.invalid")).toBe(true);
  });

  it("hasApproved is false after reject", () => {
    const created = store.create({
      name: "Ola",
      email: "ola@example.invalid",
      company: "Hei",
    });
    store.updateStatus(created.id, "approved");
    store.updateStatus(created.id, "rejected");
    expect(store.hasApproved("ola@example.invalid")).toBe(false);
  });

  it("returns the existing pending request for the same email", () => {
    const first = store.create({
      name: "Ola",
      email: "ola@example.invalid",
      company: "Første",
    });
    const second = store.create({
      name: "Ola Nordmann",
      email: "OLA@example.invalid",
      company: "Andre",
    });
    expect(second.id).toBe(first.id);
    expect(second.company).toBe("Andre");
    expect(store.list()).toHaveLength(1);
  });

  it("throws when updating a missing request", () => {
    expect(() => store.updateStatus("missing", "rejected")).toThrow(AppError);
  });

  it("removes a request and clears approval", () => {
    const created = store.create({
      name: "Ola",
      email: "ola@example.invalid",
      company: "Hei",
    });
    store.updateStatus(created.id, "approved");
    store.remove(created.id);
    expect(store.list()).toHaveLength(0);
    expect(store.hasApproved("ola@example.invalid")).toBe(false);
    expect(() => store.remove(created.id)).toThrow(AppError);
  });

  it("maps an email to the latest non-empty company", () => {
    const first = store.create({
      name: "Ola",
      email: "ola@example.invalid",
      company: "Første",
    });
    store.updateStatus(first.id, "approved");
    store.create({
      name: "Ola",
      email: "OLA@example.invalid",
      company: "Andre",
    });
    expect(store.companyByEmail().get("ola@example.invalid")).toBe("Andre");
    expect(store.companyByEmail().has("missing@example.invalid")).toBe(false);
  });
});
