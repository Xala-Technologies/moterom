import { describe, expect, it } from "vitest";
import {
  selectedPhysicalZones,
  zonesForProduct,
  zonesOverlap,
} from "../shared/zones";

describe("zonesOverlap", () => {
  it("treats matching non-sal rooms as overlap and distinct ones as free", () => {
    expect(zonesOverlap("elvebredden", "elvebredden")).toBe(true);
    expect(zonesOverlap("elvebredden", "biblioteket")).toBe(false);
  });

  it("blocks overlapping hall products and leaves Sal 3 free of Sal 1–2", () => {
    expect(zonesOverlap("sal-1-2", "sal-1")).toBe(true);
    expect(zonesOverlap("sal-1-2", "sal-2")).toBe(true);
    expect(zonesOverlap("sal-1-2", "sal-1-3")).toBe(true);
    expect(zonesOverlap("sal-1-2", "sal-3")).toBe(false);
    expect(zonesOverlap("sal-1", "sal-2")).toBe(false);
    expect(zonesOverlap("sal-1-3", "sal-3")).toBe(true);
  });

  it("exposes product zone sets for the UX stripe", () => {
    expect(zonesForProduct("sal-1-3")).toEqual(["sal-1", "sal-2", "sal-3"]);
    expect(selectedPhysicalZones("sal-1-2").has("sal-3")).toBe(false);
    expect(selectedPhysicalZones("sal-1-2").has("sal-1")).toBe(true);
  });
});
