import { describe, expect, it } from "vitest";
import { digilistRateLimitError } from "../server/digilist";
import { translateMessage } from "../shared/i18n/messages";

describe("digilistRateLimitError", () => {
  it("maps Digilist SMS rate-limit detail to a wait message", () => {
    const error = digilistRateLimitError(
      429,
      "Rate limit exceeded for requestSmsCode. Try again in ~248s.",
    );
    expect(error?.status).toBe(429);
    expect(error?.code).toBe("too_many_attempts_wait");
    expect(error?.params).toEqual({ minutes: 5 });
    expect(
      translateMessage("nb", error!.code, error!.params, error!.message),
    ).toBe("For mange forsøk. Prøv igjen om 5 minutter.");
    expect(
      translateMessage("en", error!.code, error!.params, error!.message),
    ).toBe("Too many attempts. Try again in 5 minutes.");
  });

  it("maps rate-limit text without a wait time", () => {
    const error = digilistRateLimitError(
      400,
      "Rate limit exceeded for requestEmailCode.",
    );
    expect(error?.code).toBe("too_many_attempts");
    expect(error?.status).toBe(429);
  });

  it("ignores unrelated Digilist errors", () => {
    expect(digilistRateLimitError(400, "Invalid phone number")).toBeUndefined();
  });
});
