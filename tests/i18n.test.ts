import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  nextLocale,
  resolveLocale,
  toBcp47,
} from "../shared/i18n/locale";
import { translateMessage } from "../shared/i18n/messages";
import { roomCopy } from "../shared/i18n/room";
import { displayDate, formatCount, money, shortTime } from "../shared/time";

describe("locale helpers", () => {
  it("defaults to Norwegian Bokmål", () => {
    expect(DEFAULT_LOCALE).toBe("nb");
    expect(resolveLocale(undefined, undefined)).toBe("nb");
    expect(resolveLocale(undefined, "de-DE,fr;q=0.8")).toBe("nb");
  });

  it("honours cookie and Accept-Language", () => {
    expect(resolveLocale("en", "nb")).toBe("en");
    expect(resolveLocale(undefined, "en-GB,en;q=0.9")).toBe("en");
    expect(resolveLocale(undefined, "nn-NO,en;q=0.5")).toBe("nb");
  });

  it("maps BCP-47 and cycles locales", () => {
    expect(toBcp47("nb")).toBe("nb-NO");
    expect(toBcp47("en")).toBe("en-GB");
    expect(nextLocale("nb")).toBe("en");
    expect(nextLocale("en")).toBe("nb");
  });
});

describe("message catalog", () => {
  it("localizes error codes with interpolation", () => {
    expect(translateMessage("nb", "login_required")).toContain("Logg inn");
    expect(translateMessage("en", "login_required")).toContain("Sign in");
    expect(
      translateMessage("en", "room_setup_unavailable", { name: "Sauda 1" }),
    ).toContain("Sauda 1");
  });
});

describe("formatters", () => {
  it("formats money and counts for both locales without changing Oslo timezone", () => {
    expect(money(null, "NOK", "nb")).toBe("Pris etter avtale");
    expect(money(null, "NOK", "en")).toBe("Price on request");
    expect(money(0, "NOK", "en")).toBe("No payment");
    expect(formatCount(1000, "en")).toMatch(/1[,.]000|1\s000/);
    const noon = Date.parse("2026-06-15T10:00:00Z");
    expect(shortTime(noon, "nb")).toMatch(/\d/);
    expect(displayDate("2026-06-15", false, "en")).toMatch(/Jun|15/);
  });
});

describe("roomCopy", () => {
  const room = {
    description: "Norsk tekst",
    descriptionEn: "English text",
    capacityLabel: "12 personer",
    capacityLabelEn: "12 people",
  };

  it("selects English fields and falls back to Norwegian", () => {
    expect(roomCopy(room, "en").description).toBe("English text");
    expect(roomCopy(room, "nb").description).toBe("Norsk tekst");
    expect(roomCopy({ ...room, descriptionEn: "" }, "en").description).toBe(
      "Norsk tekst",
    );
  });
});
