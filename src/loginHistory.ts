/** Device-local login helpers: recent emails + Digilist-style device trust. */

const EMAIL_KEY = "moterom.login.emails";
/** Digilist dashboard key — same origin can share one-tap accounts. */
const DIGILIST_EMAIL_KEY = "digilist_remembered_emails";
const TRUST_EMAIL_KEY = "moterom.login.trusted.emails";
const TRUST_PHONE_KEY = "moterom.login.trusted.phones";
const MAX_EMAILS = 8;
const DIGILIST_MAX_EMAILS = 5;

/** Silent trust after any successful OTP (Digilist default). */
export const DEFAULT_TRUST_MS = 7 * 24 * 60 * 60 * 1000;
/** Extended trust when "stay logged in 30 days" is checked. */
export const REMEMBER_TRUST_MS = 30 * 24 * 60 * 60 * 1000;

type TrustChannel = "email" | "phone";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/[\s\-()]/g, "");
}

function normalizeIdentifier(value: string, channel: TrustChannel) {
  return channel === "phone" ? normalizePhone(value) : normalizeEmail(value);
}

function trustStorageKey(channel: TrustChannel) {
  return channel === "phone" ? TRUST_PHONE_KEY : TRUST_EMAIL_KEY;
}

function readTrustMap(
  channel: TrustChannel,
): Record<string, { expiresAt: number }> {
  try {
    const raw = localStorage.getItem(trustStorageKey(channel));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, { expiresAt: number }> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as { expiresAt?: unknown }).expiresAt === "number"
      ) {
        const expiresAt = (value as { expiresAt: number }).expiresAt;
        if (expiresAt > Date.now()) out[key] = { expiresAt };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeTrustMap(
  channel: TrustChannel,
  map: Record<string, { expiresAt: number }>,
) {
  try {
    localStorage.setItem(trustStorageKey(channel), JSON.stringify(map));
  } catch {
    // Private mode / quota — ignore.
  }
}

function readEmailsFromKey(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map(normalizeEmail)
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  } catch {
    return [];
  }
}

function mergeEmailLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const email of list) {
      if (seen.has(email)) continue;
      seen.add(email);
      out.push(email);
      if (out.length >= MAX_EMAILS) return out;
    }
  }
  return out;
}

export function readLoginEmails(): string[] {
  return mergeEmailLists(
    readEmailsFromKey(EMAIL_KEY),
    readEmailsFromKey(DIGILIST_EMAIL_KEY),
  );
}

function writeLoginEmails(next: string[]) {
  try {
    localStorage.setItem(EMAIL_KEY, JSON.stringify(next.slice(0, MAX_EMAILS)));
    // Keep Digilist’s key in sync for same-origin dashboard one-tap accounts.
    localStorage.setItem(
      DIGILIST_EMAIL_KEY,
      JSON.stringify(next.slice(0, DIGILIST_MAX_EMAILS)),
    );
  } catch {
    // Private mode / quota — ignore.
  }
}

export function rememberLoginEmail(value: string) {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const next = mergeEmailLists(
    [email],
    readEmailsFromKey(EMAIL_KEY),
    readEmailsFromKey(DIGILIST_EMAIL_KEY),
  );
  writeLoginEmails(next);
}

export function removeLoginEmail(value: string) {
  const email = normalizeEmail(value);
  const next = readLoginEmails().filter((item) => item !== email);
  writeLoginEmails(next);
  return next;
}

/** Drop remembered email and device trust after portal access is denied. */
export function forgetLoginIdentity(value: string) {
  const email = normalizeEmail(value);
  if (!email) return;
  removeLoginEmail(email);
  const map = readTrustMap("email");
  if (map[email]) {
    delete map[email];
    writeTrustMap("email", map);
  }
}

/** Mark email/phone trusted so the next login on this device can skip OTP. */
export function trustLoginIdentifier(
  value: string,
  channel: TrustChannel,
  durationMs: number = DEFAULT_TRUST_MS,
) {
  const id = normalizeIdentifier(value, channel);
  if (!id) return;
  if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return;
  const map = readTrustMap(channel);
  const nextExpires = Date.now() + durationMs;
  map[id] = { expiresAt: Math.max(map[id]?.expiresAt ?? 0, nextExpires) };
  writeTrustMap(channel, map);
}

export function isLoginIdentifierTrusted(
  value: string,
  channel: TrustChannel,
): boolean {
  const id = normalizeIdentifier(value, channel);
  if (!id) return false;
  return (readTrustMap(channel)[id]?.expiresAt ?? 0) > Date.now();
}

/** After OTP success: 30-day trust when opted in, else Digilist's 7-day silent window. */
export function rememberDeviceAfterLogin(opts: {
  email?: string;
  phone?: string;
  stayLoggedIn: boolean;
}) {
  const duration = opts.stayLoggedIn ? REMEMBER_TRUST_MS : DEFAULT_TRUST_MS;
  if (opts.email) {
    rememberLoginEmail(opts.email);
    trustLoginIdentifier(opts.email, "email", duration);
  }
  if (opts.phone) trustLoginIdentifier(opts.phone, "phone", duration);
}
