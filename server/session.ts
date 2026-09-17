import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt, SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { secret, production } from "./config";
const key = createHash("sha256").update(secret).digest();
const cookieName = production ? "__Host-moterom" : "moterom-session";
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
export async function readSession(req: Request): Promise<Session | undefined> {
  const raw = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!raw) return;
  try {
    return (
      await jwtDecrypt(raw, key, { issuer: "moterom", audience: "session" })
    ).payload as Session;
  } catch {
    return;
  }
}
export async function writeSession(res: Response, session: Session) {
  const rememberMe = session.rememberMe !== false;
  const maxAge = rememberMe ? SESSION_MAX_AGE_MS : SESSION_SHORT_AGE_MS;
  const ttl = rememberMe ? "30d" : "8h";
  const value = await new EncryptJWT({ ...session, rememberMe })
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
