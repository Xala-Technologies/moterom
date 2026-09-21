import { describe, expect, it } from "vitest";
import { openingAccessFilter } from "../src/components/admin/accessRequestFilter";

describe("opening access-request filter", () => {
  it("stays on waiting when someone is still pending", () => {
    expect(
      openingAccessFilter([{ status: "approved" }, { status: "pending" }]),
    ).toBe("pending");
  });

  it("opens on all when only treated requests exist", () => {
    expect(openingAccessFilter([{ status: "approved" }])).toBe("all");
  });

  it("stays on waiting when the list is empty", () => {
    expect(openingAccessFilter([])).toBe("pending");
  });
});
