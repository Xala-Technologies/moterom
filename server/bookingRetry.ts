import { createHash } from "node:crypto";
import type { BookingInput } from "../shared/types";
import { AppError } from "../shared/validation";

/** The quote can be renewed; the reservation described by a retry cannot. */
export function bookingFingerprint(input: BookingInput, userId: string) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        userId,
        input.roomId,
        input.date,
        input.start,
        input.end,
        input.people,
        input.name.trim(),
        input.email.trim().toLowerCase(),
        input.phone?.trim() || "",
        input.title,
        input.notes,
      ]),
    )
    .digest("hex");
}

export function assertSameBooking(matches: boolean): asserts matches {
  if (!matches)
    throw new AppError(
      409,
      "Bestillingen ble endret. Kontroller opplysningene på nytt.",
      "booking_fingerprint_mismatch",
    );
}
