import { randomUUID } from "node:crypto";
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
import { interval, suggestedSlots } from "../shared/time";
import { translateMessage } from "../shared/i18n/messages";
import { requestLocale } from "./locale";
import type {
  InsightsCoverage,
  Room,
  Search,
  TimeSlot,
  User,
} from "../shared/types";
import {
  buildInsights,
  buildRoomReport,
  INSIGHTS_LOOKBACK_MS,
  INSIGHTS_UPCOMING_DAYS,
  parseInsightsQuery,
  previousPeriod,
} from "./insights";
import { saveDemoRoomImage } from "./roomImage";
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
    return next(
      new AppError(
        403,
        "Ugyldig forespørsel. Last siden på nytt.",
        "invalid_origin",
      ),
    );
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
      ? new AppError(
          429,
          "For mange forsøk. Vent et minutt og prøv igjen.",
          "too_many_attempts",
        )
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
  } else if (config.mode === "demo" && session?.demoGuest) {
    user = {
      id: session.demoGuest.id,
      name: session.demoGuest.name,
      email: session.demoGuest.email,
      isAdmin: false,
      isMember: true,
    };
  } else if (config.mode === "live" && session?.token) {
    user = await liveUser(session);
    if (await refreshAccess(session)) await writeSession(res, session);
  }
  if ((requireUser || config.access === "members") && !user)
    throw new AppError(401, "Logg inn for å fortsette.", "login_required");
  if (config.access === "members" && user && !user.isMember)
    throw new AppError(
      403,
      "Du må være medlem av bygget for å bestille.",
      "building_member_required",
    );
  if (requireAdmin && !user?.isAdmin)
    throw new AppError(
      403,
      "Du har ikke administratortilgang.",
      "admin_required",
    );
  return { session, user, provider: demo || new Digilist(session) };
}
async function contextForQuote(req: Request, res: Response): Promise<Context> {
  const ctx = await context(req, res, config.mode === "live");
  if (ctx.user) return ctx;
  if (!demo)
    throw new AppError(401, "Logg inn for å fortsette.", "login_required");
  const guest: User = {
    id: `demo-guest-${randomUUID()}`,
    name: "Gjest",
    email: "guest@example.invalid",
    isAdmin: false,
    isMember: true,
  };
  const session: Session = {
    demoGuest: { id: guest.id, name: guest.name, email: guest.email },
  };
  await writeSession(res, session);
  return { ...ctx, session, user: guest };
}
const parseSearch = (value: unknown) => {
  const search = searchSchema.parse(value);
  try {
    interval(search);
  } catch (e) {
    throw new AppError(
      400,
      e instanceof Error ? e.message : "Velg en gyldig dato og tid.",
      "invalid_datetime",
    );
  }
  return search;
};
const queryRecord = (query: Request["query"]) => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query))
    out[key] = Array.isArray(value) ? value[0] : value;
  return out;
};
async function insightsResponse(
  ctx: Context,
  rooms: Room[],
  query: Record<string, unknown>,
  options: { roomId?: string; locale?: ReturnType<typeof requestLocale> } = {},
) {
  const { roomId, locale = "nb" } = options;
  const parsed = parseInsightsQuery(
    query,
    rooms.map((r) => r.id),
  );
  const scoped = rooms.filter((r) => parsed.roomIds.includes(r.id));
  if (roomId && !rooms.some((r) => r.id === roomId))
    throw new AppError(404, "Rommet ble ikke funnet.", "room_not_found");
  const upcomingTo = Date.now() + INSIGHTS_UPCOMING_DAYS * 24 * 60 * 60 * 1000;
  const current = await ctx.provider.listForInsights(ctx.user!, {
    fetchFrom: parsed.period.fromMs - INSIGHTS_LOOKBACK_MS,
    fetchTo: roomId
      ? Math.max(parsed.period.toMs, upcomingTo)
      : parsed.period.toMs,
  });
  let comparePeriod;
  let compareBookings;
  let compareCoverage: InsightsCoverage | undefined;
  if (parsed.compare) {
    comparePeriod = previousPeriod(parsed.period);
    const previous = await ctx.provider.listForInsights(ctx.user!, {
      fetchFrom: comparePeriod.fromMs - INSIGHTS_LOOKBACK_MS,
      fetchTo: comparePeriod.toMs,
    });
    compareBookings = previous.bookings;
    compareCoverage = previous.truncated ? "truncated" : "complete";
  }
  const envelope = buildInsights({
    mode: config.mode,
    rooms: roomId ? scoped.filter((r) => r.id === roomId) : scoped,
    bookings: current.bookings,
    coverage: current.truncated ? "truncated" : "complete",
    period: parsed.period,
    comparePeriod,
    compareBookings,
    compareCoverage,
    locale,
  });
  if (!roomId) return envelope;
  return buildRoomReport({
    envelope,
    roomId,
    bookings: current.bookings,
    blocks: await ctx.provider.listBlocksForInsights(ctx.user!),
    locale,
  });
}
app.get("/api/config", (_req, res) => res.json(config));
app.get("/api/floorplan", async (req, res) => {
  await context(req, res);
  if (!config.floorplanAvailable)
    throw new AppError(
      404,
      "Plantegning er ikke tilgjengelig.",
      "floorplan_unavailable",
    );
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
  if (!demo) throw new AppError(404, "Siden finnes ikke.", "not_found");
  const role = z.enum(["customer", "admin"]).parse(req.body.role);
  await writeSession(res, { demoRole: role });
  res.json({ success: true });
});
app.post("/api/auth/request", async (req, res) => {
  if (demo) throw new AppError(400, "Bruk demoinnloggingen.", "use_demo_login");
  const email = z.email().max(254).parse(req.body.email).toLowerCase().trim();
  const data = await rest("/auth/email/request", "POST", { email });
  res.json({ verificationId: z.string().parse(data.verificationId) });
});
app.post("/api/auth/verify", async (req, res) => {
  if (demo) throw new AppError(400, "Bruk demoinnloggingen.", "use_demo_login");
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
  if (demo) throw new AppError(404, "Siden finnes ikke.", "not_found");
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
    throw new AppError(
      401,
      "Koden kunne ikke bekreftes. Prøv igjen.",
      "code_unverified",
    );
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
  const locale = requestLocale(req);
  res.json(await ctx.provider.availability(parseSearch(req.query), locale));
});
app.get("/api/availability/slots", async (req, res) => {
  const ctx = await context(req, res);
  const locale = requestLocale(req);
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .parse(req.query.date);
  const roomId = req.query.roomId
    ? z.string().min(1).max(100).parse(req.query.roomId)
    : undefined;
  const slots: TimeSlot[] = await Promise.all(
    suggestedSlots().map(async (slot) => {
      const search = { date, start: slot.start, end: slot.end, people: 1 };
      try {
        parseSearch(search);
      } catch (error) {
        return {
          ...slot,
          state: "error" as const,
          reason:
            error instanceof AppError
              ? translateMessage(
                  locale,
                  error.code,
                  error.params,
                  error.message,
                )
              : translateMessage(locale, "invalid_datetime"),
        };
      }
      const availability = await ctx.provider.availability(search, locale);
      const relevant = roomId
        ? availability.filter((item) => item.roomId === roomId)
        : availability;
      if (roomId && relevant.length === 0)
        return {
          ...slot,
          state: "unavailable" as const,
          reason: translateMessage(locale, "room_not_found"),
        };
      if (relevant.some((item) => item.state === "error"))
        return {
          ...slot,
          state: "error" as const,
          reason: translateMessage(locale, "availability_fetch_failed"),
        };
      const free = relevant.some((item) => item.state === "available");
      return {
        ...slot,
        state: free ? ("available" as const) : ("unavailable" as const),
        reason: free
          ? undefined
          : roomId
            ? translateMessage(locale, "room_busy_slot")
            : translateMessage(locale, "no_rooms_slot"),
      };
    }),
  );
  res.json(slots);
});
async function quote(ctx: Context, roomId: string, search: Search) {
  if (!ctx.user)
    throw new AppError(401, "Logg inn for å fortsette.", "login_required");
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
  const ctx = await contextForQuote(req, res);
  const search = parseSearch(req.body);
  const roomId = z.string().max(100).parse(req.body.roomId);
  const availability = (await ctx.provider.availability(search)).find(
    (a) => a.roomId === roomId,
  );
  if (availability?.state !== "available")
    throw new AppError(
      409,
      availability?.reason || "Rommet kan ikke bestilles.",
      "room_not_bookable",
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
  const ctx = await contextForQuote(req, res);
  const input = bookingSchema.parse(req.body);
  const key = z.string().uuid().parse(req.headers["idempotency-key"]);
  if (
    config.mode === "live" &&
    input.email.trim().toLowerCase() !== ctx.user!.email.toLowerCase()
  )
    throw new AppError(
      400,
      "E-posten må være den du er innlogget med.",
      "email_must_match_session",
    );
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
        "booking_changed",
      );
  if (claims.userId !== ctx.user!.id)
    throw new AppError(
      403,
      "Bestillingen tilhører en annen bruker.",
      "booking_belongs_to_other",
    );
  const current = await quote(ctx, input.roomId, input);
  if (
    current.total !== claims.total ||
    current.currency !== claims.currency ||
    current.requiresApproval !== claims.requiresApproval
  )
    throw new AppError(
      409,
      "Pris eller bestillingsvilkår er endret. Kontroller bestillingen på nytt.",
      "quote_terms_changed",
    );
  if (current.paymentMode === "hosted")
    throw new AppError(
      409,
      "Denne bestillingen må fullføres i Digilist.",
      "complete_in_digilist",
    );
  const result = await ctx.provider.create(input, ctx.user!, key);
  if (demo && ctx.session?.demoGuest)
    await writeSession(res, {
      demoGuest: {
        id: ctx.user!.id,
        name: input.name,
        email: input.email,
      },
    });
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
    `DESCRIPTION:${esc(translateMessage(requestLocale(req), "ics_reference", { reference: b.reference }))}`,
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
app.get("/api/admin/insights/rooms/:id", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res.json(
    await insightsResponse(
      ctx,
      await ctx.provider.rooms(),
      queryRecord(req.query),
      {
        roomId: String(req.params.id),
        locale: requestLocale(req),
      },
    ),
  );
});
app.get("/api/admin/insights", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res.json(
    await insightsResponse(
      ctx,
      await ctx.provider.rooms(),
      queryRecord(req.query),
      {
        locale: requestLocale(req),
      },
    ),
  );
});
app.patch("/api/admin/rooms/:id", async (req, res) => {
  const ctx = await context(req, res, true, true);
  const body = roomSchema.parse(req.body);
  const { imageFile, ...fields } = body;
  let image = fields.image?.trim();
  let imageKind = fields.imageKind;
  if (imageFile) {
    if (config.mode !== "demo")
      throw new AppError(
        400,
        "I live-modus må rombilder publiseres i Digilist.",
        "image_upload_demo_only",
      );
    image = await saveDemoRoomImage(String(req.params.id), imageFile);
    imageKind = imageKind ?? "illustrative";
  }
  res.json(
    await ctx.provider.updateRoom(
      String(req.params.id),
      {
        ...fields,
        ...(image !== undefined ? { image } : {}),
        imageKind,
      },
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
  next(new AppError(404, "Siden finnes ikke.", "not_found")),
);
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const locale = requestLocale(req);
  if (error instanceof AppError) {
    return res.status(error.status).json({
      code: error.code,
      message: translateMessage(
        locale,
        error.code,
        error.params,
        error.message,
      ),
    });
  }
  const status = error instanceof z.ZodError ? 400 : 502;
  const code =
    error instanceof z.ZodError
      ? "validation_failed"
      : "booking_service_incomplete";
  res.status(status).json({
    code,
    message: translateMessage(locale, code),
  });
});
