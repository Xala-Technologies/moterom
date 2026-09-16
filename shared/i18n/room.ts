import type { Locale } from "./locale";

export function roomCopy(
  room: {
    description?: string;
    descriptionEn?: string;
    capacityLabel: string;
    capacityLabelEn?: string;
  },
  locale: Locale,
) {
  return {
    description:
      locale === "en" && room.descriptionEn
        ? room.descriptionEn
        : (room.description ?? ""),
    capacityLabel:
      locale === "en" && room.capacityLabelEn
        ? room.capacityLabelEn
        : room.capacityLabel,
  };
}
