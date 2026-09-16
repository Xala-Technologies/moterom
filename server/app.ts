import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import { z } from "zod";
import { config, inventory, origin, production, floorplanPath } from "./config";
import { DemoStore } from "./demo";
import {
  Digilist,
  rest,
  liveUser,
  refreshAccess,
  setBuildingContext,
  action,
  client,
} from "./digilist";
import {
  readSession,
  writeSession,
  clearSession,
  signQuote,
  verifyQuote,
  type Session,
} from "./session";
import {
  AppError,
  bookingSchema,
  roomSchema,
  searchSchema,
} from "../shared/validation";
import { interval } from "../shared/time";
import type { Search, User } from "../shared/types";
const demo =
  config.mode === "demo"
    ? new DemoStore(process.env.DEMO_DB_PATH || ".data/demo.sqlite", inventory)
    : undefined;
interface Context {
  session?: Session;
  user?: User;
  provider: DemoStore | Digilist;
}
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "https:", "data:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin !== origin
  )
    return next(new AppError(403, "Ugyldig forespørsel. Last siden på nytt."));
  next();
});
const attempts = new Map<string, { count: number; expires: number }>();
app.use("/api/auth", (req, _res, next) => {
  if (req.method !== "POST") return next();
  const key = req.ip || "unknown";
  const now = Date.now();
  const previous = attempts.get(key);
  const entry =
    previous && previous.expires > now
      ? previous
      : { count: 0, expires: now + 60000 };
  entry.count++;
  attempts.set(key, entry);
  if (attempts.size > 10000)
    for (const [key, item] of attempts)
      if (item.expires < now) attempts.delete(key);
  next(
    entry.count > 15
      ? new AppError(429, "For mange forsøk. Vent et minutt og prøv igjen.")
      : undefined,
  );
});
async function context(
  req: Request,
  res: Response,
  requireUser = false,
  requireAdmin = false,
): Promise<Context> {
  const session = await readSession(req);
  let user: User | undefined;
  if (config.mode === "demo" && session?.demoRole) {
    const admin = session.demoRole === "admin";
    user = {
      id: admin ? "demo-admin" : "demo-customer",
      name: admin ? "Demo administrator" : "Kari Nordmann",
      email: admin ? "admin@example.invalid" : "kari@example.invalid",
      isAdmin: admin,
      isMember: true,
    };
  } else if (config.mode === "live" && session?.token) {
    user = await liveUser(session);
    if (await refreshAccess(session)) await writeSession(res, session);
  }
  if ((requireUser || config.access === "members") && !user)
    throw new AppError(401, "Logg inn for å fortsette.");
  if (config.access === "members" && user && !user.isMember)
    throw new AppError(403, "Du må være medlem av bygget for å bestille.");
  if (requireAdmin && !user?.isAdmin)
    throw new AppError(403, "Du har ikke administratortilgang.");
  return { session, user, provider: demo || new Digilist(session) };
}
const parseSearch = (value: unknown) => {
  const search = searchSchema.parse(value);
  try {
    interval(search);
  } catch (e) {
    throw new AppError(
      400,
      e instanceof Error ? e.message : "Velg en gyldig dato og tid.",
    );
  }
  return search;
};
app.get("/api/config", (_req, res) => res.json(config));
app.get("/api/floorplan", async (req, res) => {
  await context(req, res);
  if (!config.floorplanAvailable)
    throw new AppError(404, "Plantegning er ikke tilgjengelig.");
  res.sendFile(floorplanPath);
});
app.get("/api/session", async (req, res) => {
  const session = await readSession(req);
  if (!session) return res.json({ user: null });
  try {
    const ctx = await context(req, res);
    res.json({ user: ctx.user ?? null });
  } catch (e) {
    if (e instanceof AppError && e.status === 401) {
      clearSession(res);
      res.json({ user: null });
    } else throw e;
  }
});
app.post("/api/auth/demo", async (req, res) => {
  if (!demo) throw new AppError(404, "Siden finnes ikke.");
  const role = z.enum(["customer", "admin"]).parse(req.body.role);
  await writeSession(res, { demoRole: role });
  res.json({ success: true });
});
app.post("/api/auth/request", async (req, res) => {
  if (demo) throw new AppError(400, "Bruk demoinnloggingen.");
  const email = z.email().max(254).parse(req.body.email).toLowerCase().trim();
  const data = await rest("/auth/email/request", "POST", { email });
  res.json({ verificationId: z.string().parse(data.verificationId) });
});
app.post("/api/auth/verify", async (req, res) => {
  if (demo) throw new AppError(400, "Bruk demoinnloggingen.");
  const body = z
    .object({
      email: z.email().max(254),
      verificationId: z.string().max(300),
      code: z.string().regex(/^\d{6}$/),
    })
    .parse(req.body);
  const result = await rest("/auth/email/verify", "POST", body);
  if (result.requiresMfa)
    return res.json({
      mfaChallengeId: z.string().parse(result.mfaChallengeId),
    });
  const session: Session = { token: z.string().parse(result.token) };
  await setBuildingContext(session);
  await writeSession(res, session);
  res.json({ success: true });
});
app.post("/api/auth/mfa", async (req, res) => {
  if (demo) throw new AppError(404, "Siden finnes ikke.");
  const body = z
    .object({
      challengeId: z.string().max(300),
      code: z.string().min(6).max(32),
    })
    .parse(req.body);
  const result = z
    .object({ success: z.boolean(), sessionToken: z.string().optional() })
    .parse(
      await action(
        client(),
        "auth/mfaChallenge:confirmMfaLoginChallenge",
        body,
      ),
    );
  if (!result.success || !result.sessionToken)
    throw new AppError(401, "Koden kunne ikke bekreftes. Prøv igjen.");
  const session: Session = { token: result.sessionToken };
  await setBuildingContext(session);
  await writeSession(res, session);
  res.json({ success: true });
});
app.post("/api/auth/logout", async (req, res) => {
  const session = await readSession(req);
  if (config.mode === "live" && session?.token)
    await rest("/auth/logout", "POST", undefined, session.token);
  clearSession(res);
  res.json({ success: true });
});
app.get("/api/rooms", async (req, res) => {
  const ctx = await context(req, res);
  res.json(await ctx.provider.rooms());
});
app.get("/api/availability", async (req, res) => {
  const ctx = await context(req, res);
  res.json(await ctx.provider.availability(parseSearch(req.query)));
});
async function quote(ctx: Context, roomId: string, search: Search) {
  if (!ctx.user) throw new AppError(401, "Logg inn for å fortsette.");
  const room = await ctx.provider.room(roomId);
  return demo
    ? {
        total: 0,
        currency: "NOK",
        priceOnRequest: false,
        requiresApproval: room.requiresApproval,
        paymentMode: "none" as const,
      }
    : (ctx.provider as Digilist).quote(roomId, search, ctx.user);
}
app.post("/api/quote", async (req, res) => {
  const ctx = await context(req, res, true);
  const search = parseSearch(req.body);
  const roomId = z.string().max(100).parse(req.body.roomId);
  const availability = (await ctx.provider.availability(search)).find(
    (a) => a.roomId === roomId,
  );
  if (availability?.state !== "available")
    throw new AppError(
      409,
      availability?.reason || "Rommet kan ikke bestilles.",
    );
  const result = await quote(ctx, roomId, search);
  const token = await signQuote({
    userId: ctx.user!.id,
    roomId,
    ...search,
    total: result.total,
    currency: result.currency,
    requiresApproval: result.requiresApproval,
  });
  // The signed quote contains only review data. Never expose backend internals.
  res.json({
    total: result.total,
    currency: result.currency,
    priceOnRequest: result.priceOnRequest,
    requiresApproval: result.requiresApproval,
    paymentMode: result.paymentMode,
    token,
  });
});
app.post("/api/bookings", async (req, res) => {
  const ctx = await context(req, res, true);
  const input = bookingSchema.parse(req.body);
  const key = z.string().uuid().parse(req.headers["idempotency-key"]);
  let claims: Awaited<ReturnType<typeof verifyQuote>>;
  try {
    claims = await verifyQuote(input.quoteToken);
  } catch {
    throw new AppError(
      409,
      "Pristilbudet er utløpt. Kontroller bestillingen på nytt.",
      "quote_expired",
    );
  }
  for (const field of ["roomId", "date", "start", "end", "people"] as const)
    if (claims[field] !== input[field])
      throw new AppError(
        409,
        "Bestillingen er endret. Kontroller valget på nytt.",
      );
  if (claims.userId !== ctx.user!.id)
    throw new AppError(403, "Bestillingen tilhører en annen bruker.");
  const current = await quote(ctx, input.roomId, input);
  if (
    current.total !== claims.total ||
    current.currency !== claims.currency ||
    current.requiresApproval !== claims.requiresApproval
  )
    throw new AppError(
      409,
      "Pris eller bestillingsvilkår er endret. Kontroller bestillingen på nytt.",
    );
  if (current.paymentMode === "hosted")
    throw new AppError(409, "Denne bestillingen må fullføres i Digilist.");
  const result = await ctx.provider.create(input, ctx.user!, key);
  res.status(201).json(result);
});
app.get("/api/bookings", async (req, res) => {
  const ctx = await context(req, res, true);
  res.json(await ctx.provider.bookings(ctx.user!));
});
app.get("/api/bookings/:id", async (req, res) => {
  const ctx = await context(req, res, true);
  res.json(await ctx.provider.booking(String(req.params.id), ctx.user!));
});
app.post("/api/bookings/:id/:action", async (req, res) => {
  const op = z
    .enum(["cancel", "approve", "reject", "edit"])
    .parse(req.params.action);
  const ctx = await context(req, res, true, ["approve", "reject"].includes(op));
  const id = String(req.params.id);
  res.json(
    op === "edit"
      ? await ctx.provider.requestEdit(id, parseSearch(req.body), ctx.user!)
      : await ctx.provider.updateBooking(id, op, ctx.user!),
  );
});
app.get("/api/bookings/:id/calendar.ics", async (req, res) => {
  const ctx = await context(req, res, true);
  const b = await ctx.provider.booking(String(req.params.id), ctx.user!);
  const esc = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const dt = (value: number) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Xala//Moterom//NB",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${b.id}@moterom`,
    `DTSTAMP:${dt(Date.now())}`,
    `DTSTART:${dt(b.startTime)}`,
    `DTEND:${dt(b.endTime)}`,
    `SUMMARY:${esc(b.roomName)}`,
    `DESCRIPTION:${esc(`Referanse: ${b.reference}`)}`,
    `LOCATION:${esc(config.address)}`,
    `STATUS:${b.status === "cancelled" ? "CANCELLED" : b.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Fold UTF-8 at 75 octets as required by RFC 5545, without splitting characters.
  const folded = lines.map((line) => {
    let out = "",
      count = 0;
    for (const char of line) {
      const size = Buffer.byteLength(char);
      if (count + size > 75) {
        out += "\r\n ";
        count = 1;
      }
      out += char;
      count += size;
    }
    return out;
  });
  res
    .type("text/calendar")
    .attachment("moterom.ics")
    .send(folded.join("\r\n") + "\r\n");
});
app.get("/api/admin", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res.json(await ctx.provider.admin(ctx.user!));
});
app.patch("/api/admin/rooms/:id", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res.json(
    await ctx.provider.updateRoom(
      String(req.params.id),
      roomSchema.parse(req.body),
      ctx.user!,
    ),
  );
});
app.post("/api/admin/blocks", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res
    .status(201)
    .json(
      await ctx.provider.createBlock(
        z.string().max(100).parse(req.body.roomId),
        parseSearch(req.body),
        z.string().trim().min(1).max(120).parse(req.body.title),
        ctx.user!,
      ),
    );
});
app.delete("/api/admin/blocks/:id", async (req, res) => {
  const ctx = await context(req, res, true, true);
  await ctx.provider.removeBlock(String(req.params.id), ctx.user!);
  res.json({ success: true });
});
app.use("/api", (_req, _res, next) =>
  next(new AppError(404, "Siden finnes ikke.")),
);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    error instanceof AppError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 502;
  const message =
    error instanceof AppError
      ? error.message
      : error instanceof z.ZodError
        ? "Kontroller feltene og prøv igjen."
        : "Bookingtjenesten kunne ikke fullføre handlingen. Prøv igjen.";
  res.status(status).json({
    message,
    code: error instanceof AppError ? error.code : "request_failed",
  });
});
