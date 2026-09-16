import { describe, expect, it } from "vitest";
import { listingUrl } from "../shared/urls";

describe("listingUrl", () => {
  it("maps a dashboard origin to the public listing path", () => {
    expect(listingUrl("https://dashboard.digilist.no", "sauda-1")).toBe(
      "https://app.digilist.no/listing/sauda-1",
    );
  });
});
