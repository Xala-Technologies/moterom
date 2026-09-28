import { describe, expect, it } from "vitest";
import { customerNavActive } from "../src/customerNavActive";

describe("customerNavActive", () => {
  it("keeps Mine bookinger active on booking detail", () => {
    expect(customerNavActive("/mine-bookinger", "/mine-bookinger")).toBe(true);
    expect(customerNavActive("/mine-bookinger", "/booking/DEMO-123")).toBe(
      true,
    );
    expect(customerNavActive("/mine-bookinger", "/meldinger")).toBe(false);
  });

  it("activates Meldinger only on the messages path", () => {
    expect(customerNavActive("/meldinger", "/meldinger")).toBe(true);
    expect(customerNavActive("/meldinger", "/booking/DEMO-123")).toBe(false);
  });
});
