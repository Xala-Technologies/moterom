import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt, SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { secret, production } from "./config";
const key = createHash("sha256").update(secret).digest();
export const cookieName = production ? "__Host-moterom" : "moterom-session";
/** Digilist stay-logged-in duration when the user opts in. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Shorter browser session when stay-logged-in is off. */
export const SESSION_SHORT_AGE_MS = 8 * 60 * 60 * 1000;
export interface Session {
  token?: string;
  accessToken?: string;
  expiresAt?: number;
  /** When true (default), cookie lasts 30 days like Digilist. */
  rememberMe?: boolean;
  demoRole?: "customer" | "admin";
  demoGuest?: { id: string; name: string; email: string };
}

/** Fields that keep the browser signed in. Access JWTs are request-scoped. */
export function durableSession(session: Session): Session {
  const rememberMe = session.rememberMe !== false;
  const out: Session = { rememberMe };
  if (session.token) out.token = session.token;
  if (session.demoRole) out.demoRole = session.demoRole;
  if (session.demoGuest) out.demoGuest = { ...session.demoGuest };
  return out;
}

export async function readSession(req: Request): Promise<Session | undefined> {
  const raw = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!raw) return;
  try {
    const payload = (
      await jwtDecrypt(decodeURIComponent(raw), key, {
        issuer: "moterom",
        audience: "session",
      })
    ).payload as Record<string, unknown>;
    const session: Session = {};
    if (typeof payload.token === "string") session.token = payload.token;
    if (typeof payload.accessToken === "string")
      session.accessToken = payload.accessToken;
    if (typeof payload.expiresAt === "number")
      session.expiresAt = payload.expiresAt;
    if (typeof payload.rememberMe === "boolean")
      session.rememberMe = payload.rememberMe;
    if (payload.demoRole === "customer" || payload.demoRole === "admin")
      session.demoRole = payload.demoRole;
    if (
      payload.demoGuest &&
      typeof payload.demoGuest === "object" &&
      payload.demoGuest !== null
    ) {
      const guest = payload.demoGuest as Record<string, unknown>;
      if (
        typeof guest.id === "string" &&
        typeof guest.name === "string" &&
        typeof guest.email === "string"
      )
        session.demoGuest = {
          id: guest.id,
          name: guest.name,
          email: guest.email,
        };
    }
    return session;
  } catch {
    return;
  }
}
export async function writeSession(res: Response, session: Session) {
  const durable = durableSession(session);
  const rememberMe = durable.rememberMe !== false;
  const maxAge = rememberMe ? SESSION_MAX_AGE_MS : SESSION_SHORT_AGE_MS;
  const ttl = rememberMe ? "30d" : "8h";
  const value = await new EncryptJWT({ ...durable })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setIssuer("moterom")
    .setAudience("session")
    .setExpirationTime(ttl)
    .encrypt(key);
  res.cookie(cookieName, value, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}
export function clearSession(res: Response) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
  });
}
export async function signQuote(data: Record<string, unknown>) {
  return new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("moterom")
    .setAudience("quote")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
export async function verifyQuote(token: string) {
  return (
    await jwtVerify(token, key, {
      issuer: "moterom",
      audience: "quote",
      algorithms: ["HS256"],
    })
  ).payload;
}
