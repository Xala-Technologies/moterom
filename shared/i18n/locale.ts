export type Locale = "nb" | "en";

export const DEFAULT_LOCALE: Locale = "nb";
export const SUPPORTED_LOCALES: Locale[] = ["nb", "en"];
export const LOCALE_STORAGE_KEY = "moterom.locale";
export const LOCALE_COOKIE = "moterom_locale";

export const LOCALE_LABELS: Record<Locale, { short: string; native: string }> =
  {
    nb: { short: "NB", native: "Norsk bokmål" },
    en: { short: "EN", native: "English" },
  };

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "nb" || value === "en";
}

export function toBcp47(locale: Locale): string {
  return locale === "en" ? "en-GB" : "nb-NO";
}

/** Resolve locale from cookie value or Accept-Language. Default nb. */
export function resolveLocale(
  cookieValue?: string | null,
  acceptLanguage?: string | null,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const tags = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return {
        tag: (tag || "").toLowerCase(),
        q: q ? Number(q.slice(2)) || 0 : 1,
      };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    if (tag.startsWith("nb") || tag.startsWith("nn") || tag === "no")
      return "nb";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

export function parseCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey?.trim() === name)
      return decodeURIComponent(rest.join("=").trim());
  }
  return undefined;
}

export function nextLocale(current: Locale): Locale {
  const index = SUPPORTED_LOCALES.indexOf(current);
  return SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length]!;
}
