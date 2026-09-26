import { randomUUID } from "node:crypto";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import { z } from "zod";
import {
  config,
  digilistAuthConfigured,
  inventory,
  isAllowedOrigin,
  production,
  floorplanPath,
  httpUrl,
  origin,
  adminEmails,
} from "./config";
import { DemoStore } from "./demo";
import { AccessRequestStore } from "./accessRequests";
import { PortalRoleStore } from "./portalRoles";
import { MessagingLocalStore, isSupportConversationId } from "./messagingLocal";
import { saveMessageImage } from "./messageImage";
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
  accessRequestCreateSchema,
  accessRequestStatusSchema,
  announcementCreateSchema,
  bookingSchema,
  isAppError,
  messageCreateSchema,
  roomSchema,
  roomCreateSchema,
  searchSchema,
  supportOpenSchema,
} from "../shared/validation";
import {
  canManagePortal,
  isPortalRole,
  resolvePortalCapabilities,
  type PortalRole,
} from "../shared/adminAccess";
import { interval, suggestedSlots } from "../shared/time";
import { translateMessage } from "../shared/i18n/messages";
import { requestLocale } from "./locale";
import type {
  ConversationSummary,
  ConversationThread,
  InsightsCoverage,
  Room,
  Search,
  TimeSlot,
  TenantMember,
  User,
} from "../shared/types";
import {
  buildInsights,
  buildRoomReport,
  assignCompany,
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
const accessRequests = new AccessRequestStore(
  process.env.ACCESS_REQUESTS_DB_PATH || ".data/access_requests.sqlite",
);
const portalRoles = new PortalRoleStore(
  process.env.PORTAL_ROLES_DB_PATH || ".data/portal_roles.sqlite",
);
const messagingLocal = new MessagingLocalStore(
  process.env.MESSAGING_LOCAL_DB_PATH || ".data/messaging_local.sqlite",
);

function withPortalRole(user: User, allowlisted: boolean): User {
  const caps = resolvePortalCapabilities({
    email: user.email,
    isMember: user.isMember,
    allowlisted,
    tenantRole: user.tenantRole,
    assigned: portalRoles.get(user.email),
  });
  return { ...user, ...caps };
}

function attachPortalRoles(members: TenantMember[]): TenantMember[] {
  return members.map((member) => {
    const caps = resolvePortalCapabilities({
      email: member.email,
      isMember: true,
      allowlisted:
        adminEmails.has(member.email.trim().toLowerCase()) ||
        config.mode === "demo",
      tenantRole: member.role,
      assigned: portalRoles.get(member.email),
    });
    return { ...member, portalRole: caps.portalRole ?? "member" };
  });
}

function demoMembers(): TenantMember[] {
  return attachPortalRoles([
    {
      userId: "demo-admin",
      name: "Demo administrator",
      email: "admin@example.invalid",
      role: "tenant_admin",
      status: "active",
      portalRole: "full",
    },
    {
      userId: "demo-customer",
      name: "Kari Nordmann",
      email: "kari@example.invalid",
      role: "member",
      status: "active",
      portalRole: "member",
    },
  ]);
}
interface Context {
  session?: Session;
  user?: User;
  provider: DemoStore | Digilist;
}
async function mergedInbox(ctx: Context): Promise<ConversationSummary[]> {
  const booking = (await ctx.provider.inbox(ctx.user!)).filter(
    (row) => !messagingLocal.isHidden(row.id),
  );
  const support = messagingLocal.inbox(ctx.user!);
  return [...booking, ...support].sort((a, b) => b.updatedAt - a.updatedAt);
}
function conversationFrom(
  ctx: Context,
  id: string,
  user: User,
): Promise<ConversationThread> | ConversationThread {
  if (isSupportConversationId(id)) {
    return messagingLocal.conversationThread(id, user);
  }
  if (messagingLocal.isHidden(id))
    throw new AppError(
      404,
      "Samtalen ble ikke funnet.",
      "conversation_not_found",
    );
  return ctx.provider.conversationThread(id, user);
}
function sendConversationFrom(
  ctx: Context,
  id: string,
  content: string,
  user: User,
  clientMessageId?: string,
  imageUrl?: string,
): Promise<ConversationThread> | ConversationThread {
  if (isSupportConversationId(id)) {
    return messagingLocal.sendConversationMessage(
      id,
      content,
      user,
      clientMessageId,
      imageUrl,
    );
  }
  if (messagingLocal.isHidden(id))
    throw new AppError(
      404,
      "Samtalen ble ikke funnet.",
      "conversation_not_found",
    );
  return ctx.provider.sendConversationMessage(
    id,
    content,
    user,
    clientMessageId,
    imageUrl,
  );
}
function deleteConversationFrom(
  ctx: Context,
  id: string,
  user: User,
): Promise<{ success: true }> | { success: true } {
  if (isSupportConversationId(id)) {
    return messagingLocal.deleteConversation(id);
  }
  if (ctx.provider instanceof Digilist) {
    return ctx.provider.conversationThread(id, user).then(() => {
      return messagingLocal.hideConversation(id);
    });
  }
  return ctx.provider.deleteConversation(id, user);
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
app.use(express.json({ limit: "3mb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const host = String(
      req.headers["x-forwarded-host"] || req.headers.host || "",
    );
    if (!isAllowedOrigin(req.headers.origin, host))
      return next(
        new AppError(
          403,
          "Ugyldig forespørsel. Last siden på nytt.",
          "invalid_origin",
        ),
      );
  }
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
app.use("/api/access-requests", (req, _res, next) => {
  if (req.method !== "POST") return next();
  const key = `access:${req.ip || "unknown"}`;
  const now = Date.now();
  const previous = attempts.get(key);
  const entry =
    previous && previous.expires > now
      ? previous
      : { count: 0, expires: now + 60000 };
  entry.count++;
  attempts.set(key, entry);
  next(
    entry.count > 10
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
  allowNonMember = false,
  allowAnonymous = false,
): Promise<Context> {
  const session = await readSession(req);
  let user: User | undefined;
  if (config.mode === "demo" && session?.demoRole) {
    const admin = session.demoRole === "admin";
    const email = admin ? "admin@example.invalid" : "kari@example.invalid";
    user = withPortalRole(
      {
        id: admin ? "demo-admin" : "demo-customer",
        name: admin ? "Demo administrator" : "Kari Nordmann",
        email,
        isAdmin: admin,
        isMember: true,
        tenantRole: admin ? "tenant_admin" : "member",
      },
      true,
    );
  } else if (config.mode === "demo" && session?.demoGuest) {
    user = withPortalRole(
      {
        id: session.demoGuest.id,
        name: session.demoGuest.name,
        email: session.demoGuest.email,
        isAdmin: false,
        isMember: true,
        tenantRole: "member",
      },
      true,
    );
  } else if (session?.token) {
    if (!httpUrl)
      throw new AppError(
        503,
        "Digilist-innlogging er ikke konfigurert.",
        "digilist_auth_unavailable",
      );
    // Digilist session token is the durable login. Access JWT mint failures
    // must not look like logout — that forced a new OTP despite rememberMe.
    const live = await liveUser(session);
    user = withPortalRole(
      live,
      adminEmails.has(live.email.trim().toLowerCase()),
    );
    try {
      if (await refreshAccess(session)) await writeSession(res, session);
    } catch (e) {
      if (e instanceof AppError && e.status === 401)
        throw new AppError(
          503,
          "Vi får ikke kontakt med bookingtjenesten. Prøv igjen.",
          "booking_service_unreachable",
        );
      throw e;
    }
  }
  if (
    (requireUser || (config.access === "members" && !allowAnonymous)) &&
    !user
  )
    throw new AppError(401, "Logg inn for å fortsette.", "login_required");
  if (config.access === "members" && user && !user.isMember && !allowNonMember)
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
async function requirePortalAdminContext(
  req: Request,
  res: Response,
): Promise<Context> {
  const ctx = await context(req, res, true, true);
  if (!canManagePortal(ctx.user))
    throw new AppError(
      403,
      "Denne handlingen krever byggadministratorrollen.",
      "portal_admin_required",
    );
  return ctx;
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
  const companies = accessRequests.companyByEmail();
  const stamped = assignCompany(current.bookings, companies);
  const stampedCompare = compareBookings
    ? assignCompany(compareBookings, companies)
    : undefined;
  const firma = typeof query.firma === "string" ? query.firma.trim() : "";
  const envelope = buildInsights({
    mode: config.mode,
    rooms: roomId ? scoped.filter((r) => r.id === roomId) : scoped,
    bookings: stamped,
    coverage: current.truncated ? "truncated" : "complete",
    period: parsed.period,
    comparePeriod,
    compareBookings: stampedCompare,
    compareCoverage,
    company: firma || undefined,
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
    // Allow non-members so the client can show the access-pending panel.
    // clearSession only when Digilist /auth/me says the session token is gone —
    // not when Convex access-token refresh fails (mapped to 503 in context).
    const ctx = await context(req, res, false, false, true);
    res.json({ user: ctx.user ?? null });
  } catch (e) {
    if (e instanceof AppError && e.status === 401) {
      clearSession(res);
      res.json({ user: null });
    } else if (e instanceof AppError && e.status === 503 && session.token) {
      // Digilist session still valid; surface identity without Convex access.
      try {
        const user = await liveUser(session);
        res.json({ user });
      } catch (inner) {
        if (inner instanceof AppError && inner.status === 401) {
          clearSession(res);
          res.json({ user: null });
        } else throw inner;
      }
    } else throw e;
  }
});
app.post("/api/auth/demo", async (req, res) => {
  if (!demo) throw new AppError(404, "Siden finnes ikke.", "not_found");
  const role = z.enum(["customer", "admin"]).parse(req.body.role);
  await writeSession(res, { demoRole: role });
  res.json({ success: true });
});
const requireDigilistHttp = () => {
  if (!digilistAuthConfigured)
    throw new AppError(
      503,
      "Digilist-innlogging er ikke konfigurert for denne installasjonen.",
      "digilist_auth_unavailable",
    );
};
app.post("/api/auth/request", async (req, res) => {
  requireDigilistHttp();
  const email = z.email().max(254).parse(req.body.email).toLowerCase().trim();
  const data = await rest("/auth/email/request", "POST", { email });
  res.json({ verificationId: z.string().parse(data.verificationId) });
});
app.post("/api/auth/verify", async (req, res) => {
  requireDigilistHttp();
  const body = z
    .object({
      email: z.email().max(254),
      verificationId: z.string().max(300),
      code: z.string().regex(/^\d{6}$/),
      rememberMe: z.boolean().optional().default(true),
    })
    .parse(req.body);
  const { rememberMe, ...verifyBody } = body;
  const result = await rest("/auth/email/verify", "POST", verifyBody);
  if (result.requiresMfa)
    return res.json({
      mfaChallengeId: z.string().parse(result.mfaChallengeId),
    });
  const session: Session = {
    token: z.string().parse(result.token),
    rememberMe,
  };
  await setBuildingContext(session);
  await writeSession(res, session);
  res.json({ success: true });
});
app.post("/api/auth/sms/request", async (req, res) => {
  requireDigilistHttp();
  const phoneNumber = z
    .string()
    .trim()
    .min(8)
    .max(32)
    .parse(req.body.phoneNumber);
  const data = await rest("/auth/sms/request", "POST", { phoneNumber });
  res.json({ verificationId: z.string().parse(data.verificationId) });
});
app.post("/api/auth/sms/verify", async (req, res) => {
  requireDigilistHttp();
  const body = z
    .object({
      phoneNumber: z.string().trim().min(8).max(32),
      verificationId: z.string().max(300),
      code: z.string().regex(/^\d{6}$/),
      rememberMe: z.boolean().optional().default(true),
    })
    .parse(req.body);
  const { rememberMe, ...verifyBody } = body;
  const result = await rest("/auth/sms/verify", "POST", verifyBody);
  if (result.requiresMfa)
    return res.json({
      mfaChallengeId: z.string().parse(result.mfaChallengeId),
    });
  const session: Session = {
    token: z.string().parse(result.token),
    rememberMe,
  };
  await setBuildingContext(session);
  await writeSession(res, session);
  res.json({ success: true });
});
app.post("/api/auth/oauth/bankid", async (req, res) => {
  requireDigilistHttp();
  const returnPath = z.string().max(500).optional().parse(req.body.returnPath);
  const safeReturn =
    returnPath &&
    returnPath.startsWith("/") &&
    !returnPath.startsWith("//") &&
    !returnPath.includes("\\")
      ? returnPath
      : "/";
  try {
    const result = z.object({ authUrl: z.string().url() }).parse(
      await action(client(), "auth/start:startOAuth", {
        provider: "bankid",
        appOrigin: origin,
        returnPath: safeReturn,
        appId: "web",
      }),
    );
    res.json({ url: result.authUrl });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "";
    if (/allow-list|unavailable|not configured|BANKID|bankid/i.test(detail))
      throw new AppError(
        503,
        "BankID er ikke tilgjengelig akkurat nå. Prøv e-post eller SMS.",
        "bankid_unavailable",
      );
    throw e;
  }
});
app.post("/api/auth/session", async (req, res) => {
  requireDigilistHttp();
  const token = z.string().min(20).max(500).parse(req.body.token);
  const rememberMe = z
    .boolean()
    .optional()
    .default(true)
    .parse(req.body.rememberMe);
  const session: Session = { token, rememberMe };
  await setBuildingContext(session);
  await writeSession(res, session);
  res.json({ success: true });
});
app.post("/api/auth/mfa", async (req, res) => {
  requireDigilistHttp();
  const body = z
    .object({
      challengeId: z.string().max(300),
      code: z.string().min(6).max(32),
      rememberMe: z.boolean().optional().default(true),
    })
    .parse(req.body);
  const { rememberMe, ...mfaBody } = body;
  const result = z
    .object({ success: z.boolean(), sessionToken: z.string().optional() })
    .parse(
      await action(
        client(),
        "auth/mfaChallenge:confirmMfaLoginChallenge",
        mfaBody,
      ),
    );
  if (!result.success || !result.sessionToken)
    throw new AppError(
      401,
      "Koden kunne ikke bekreftes. Prøv igjen.",
      "code_unverified",
    );
  const session: Session = { token: result.sessionToken, rememberMe };
  await setBuildingContext(session);
  await writeSession(res, session);
  res.json({ success: true });
});
app.post("/api/auth/logout", async (req, res) => {
  const session = await readSession(req);
  if (session?.token && httpUrl)
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
      const availability = await ctx.provider.availability(
        search,
        locale,
        roomId,
      );
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
  const availability = (
    await ctx.provider.availability(search, requestLocale(req), roomId)
  ).find((a) => a.roomId === roomId);
  if (availability?.state === "error")
    throw new AppError(
      503,
      availability.reason || "Kunne ikke hente ledigheten. Prøv igjen.",
      "availability_fetch_failed",
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
  // An authenticated retry is a read of an existing reservation. Reconcile
  // it before refreshing an expired quote or checking its now-occupied slot.
  if (ctx.provider instanceof Digilist) {
    const existing = await ctx.provider.replay(input, ctx.user!, key);
    if (existing) return res.status(201).json(existing);
  }
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
  if (current.paymentMode !== "none" || current.total !== 0)
    throw new AppError(
      409,
      "Dette rommet kan ikke bestilles med betaling i møteromsportalen. Kontakt administrator.",
      "skb_internal_booking_only",
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
app.get("/api/bookings/:id/messages", async (req, res) => {
  const ctx = await context(req, res, true);
  res.json(await ctx.provider.bookingThread(String(req.params.id), ctx.user!));
});
app.post("/api/bookings/:id/messages", async (req, res) => {
  const ctx = await context(req, res, true);
  const body = messageCreateSchema.parse(req.body);
  if (body.imageFile && ctx.provider instanceof Digilist)
    throw new AppError(
      400,
      "Bildemeldinger er ikke tilgjengelig for booking-samtaler ennå. Bruk generelle henvendelser, eller skriv en tekstmelding.",
      "message_images_unsupported",
    );
  const imageUrl = body.imageFile
    ? await saveMessageImage(body.imageFile)
    : undefined;
  res
    .status(201)
    .json(
      await ctx.provider.sendBookingMessage(
        String(req.params.id),
        body.content,
        ctx.user!,
        body.clientMessageId,
        imageUrl,
      ),
    );
});
app.get("/api/messages", async (req, res) => {
  const ctx = await context(req, res, true);
  res.json(await mergedInbox(ctx));
});
app.post("/api/messages/support", async (req, res) => {
  const ctx = await context(req, res, true);
  const body = supportOpenSchema.parse(req.body ?? {});
  res
    .status(body.content ? 201 : 200)
    .json(
      messagingLocal.openSupport(ctx.user!, body.content, body.clientMessageId),
    );
});
app.get("/api/messages/:id", async (req, res) => {
  const ctx = await context(req, res, true);
  res.json(await conversationFrom(ctx, String(req.params.id), ctx.user!));
});
app.post("/api/messages/:id", async (req, res) => {
  const ctx = await context(req, res, true);
  const body = messageCreateSchema.parse(req.body);
  const id = String(req.params.id);
  if (
    body.imageFile &&
    !isSupportConversationId(id) &&
    ctx.provider instanceof Digilist
  )
    throw new AppError(
      400,
      "Bildemeldinger er ikke tilgjengelig for booking-samtaler ennå. Bruk generelle henvendelser, eller skriv en tekstmelding.",
      "message_images_unsupported",
    );
  const imageUrl = body.imageFile
    ? await saveMessageImage(body.imageFile)
    : undefined;
  res
    .status(201)
    .json(
      await sendConversationFrom(
        ctx,
        id,
        body.content,
        ctx.user!,
        body.clientMessageId,
        imageUrl,
      ),
    );
});
app.get("/api/announcements/active", async (req, res) => {
  const ctx = await context(req, res, true);
  res.json(messagingLocal.activeForUser(ctx.user!));
});
app.post("/api/announcements/:id/dismiss", async (req, res) => {
  const ctx = await context(req, res, true);
  res.json(
    messagingLocal.dismissAnnouncement(String(req.params.id), ctx.user!),
  );
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
    `URL:${origin}/booking/${encodeURIComponent(b.id)}`,
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
app.post("/api/access-requests", async (req, res) => {
  if (config.access !== "members")
    throw new AppError(
      400,
      "Tilgangsforespørsler brukes bare når portalen er begrenset til medlemmer.",
      "access_request_members_only",
    );
  const ctx = await context(req, res, false, false, true, true);
  if (ctx.user?.isMember)
    throw new AppError(
      400,
      "Du er allerede medlem av dette bygget.",
      "already_building_member",
    );
  const body = accessRequestCreateSchema.parse(req.body);
  const created = accessRequests.create({
    ...body,
    ...(ctx.user ? { name: ctx.user.name, email: ctx.user.email } : {}),
    userId: ctx.user?.id,
  });
  res.status(201).json(created);
});
app.get("/api/admin/access-requests", async (req, res) => {
  await context(req, res, true, true);
  res.json(accessRequests.list());
});
app.patch("/api/admin/access-requests/:id", async (req, res) => {
  const ctx = await requirePortalAdminContext(req, res);
  const status = accessRequestStatusSchema.parse(req.body?.status);
  if (status === "approved" && ctx.provider instanceof Digilist) {
    const item = accessRequests.get(String(req.params.id));
    await ctx.provider.ensureActiveBooker(item.email, item.name, ctx.user!);
  }
  res.json(accessRequests.updateStatus(String(req.params.id), status));
});
app.delete("/api/admin/access-requests/:id", async (req, res) => {
  await requirePortalAdminContext(req, res);
  accessRequests.remove(String(req.params.id));
  res.json({ success: true });
});
app.get("/api/admin/members", async (req, res) => {
  const ctx = await context(req, res, true, true);
  if (ctx.provider instanceof Digilist) {
    res.json(attachPortalRoles(await ctx.provider.members(ctx.user!)));
    return;
  }
  res.json(demoMembers());
});
app.patch("/api/admin/members/portal-role", async (req, res) => {
  const ctx = await requirePortalAdminContext(req, res);
  const body = z
    .object({
      email: z.string().email(),
      role: z.string(),
    })
    .parse(req.body);
  if (!isPortalRole(body.role))
    throw new AppError(400, "Ugyldig portalrolle.", "invalid_portal_role");
  const email = body.email.trim().toLowerCase();
  if (email === ctx.user!.email.trim().toLowerCase() && body.role !== "full")
    throw new AppError(
      409,
      "Du kan ikke fjerne din egen byggadministratorrolle.",
      "cannot_demote_self",
    );
  const role = portalRoles.set(email, body.role);
  const members =
    ctx.provider instanceof Digilist
      ? attachPortalRoles(await ctx.provider.members(ctx.user!))
      : demoMembers();
  const member = members.find(
    (row) => row.email.trim().toLowerCase() === email,
  );
  res.json(
    member ?? {
      userId: email,
      name: email,
      email,
      role: "member",
      status: "active" as const,
      portalRole: role,
    },
  );
});
app.get("/api/admin/messages", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res.json(await mergedInbox(ctx));
});
app.get("/api/admin/messages/:id", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res.json(await conversationFrom(ctx, String(req.params.id), ctx.user!));
});
app.post("/api/admin/messages/:id", async (req, res) => {
  const ctx = await context(req, res, true, true);
  const body = messageCreateSchema.parse(req.body);
  const id = String(req.params.id);
  if (
    body.imageFile &&
    !isSupportConversationId(id) &&
    ctx.provider instanceof Digilist
  )
    throw new AppError(
      400,
      "Bildemeldinger er ikke tilgjengelig for booking-samtaler ennå. Bruk generelle henvendelser, eller skriv en tekstmelding.",
      "message_images_unsupported",
    );
  const imageUrl = body.imageFile
    ? await saveMessageImage(body.imageFile)
    : undefined;
  res
    .status(201)
    .json(
      await sendConversationFrom(
        ctx,
        id,
        body.content,
        ctx.user!,
        body.clientMessageId,
        imageUrl,
      ),
    );
});
app.delete("/api/admin/messages/:id", async (req, res) => {
  const ctx = await context(req, res, true, true);
  res.json(await deleteConversationFrom(ctx, String(req.params.id), ctx.user!));
});
app.get("/api/admin/announcements", async (req, res) => {
  await context(req, res, true, true);
  res.json(messagingLocal.listAnnouncements());
});
app.post("/api/admin/announcements", async (req, res) => {
  const ctx = await requirePortalAdminContext(req, res);
  const body = announcementCreateSchema.parse(req.body);
  res.status(201).json(messagingLocal.createAnnouncement(body, ctx.user!));
});
app.post("/api/admin/announcements/:id/deactivate", async (req, res) => {
  await requirePortalAdminContext(req, res);
  res.json(messagingLocal.deactivateAnnouncement(String(req.params.id)));
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
      await ctx.provider.allRooms(),
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
      await ctx.provider.allRooms(),
      queryRecord(req.query),
      {
        locale: requestLocale(req),
      },
    ),
  );
});
app.post("/api/admin/rooms", async (req, res) => {
  const ctx = await requirePortalAdminContext(req, res);
  const body = roomCreateSchema.parse(req.body);
  const { imageFile, ...fields } = body;
  let image = fields.image?.trim();
  let imageKind = fields.imageKind;
  if (imageFile && config.mode !== "demo")
    throw new AppError(
      400,
      "I live-modus må rombilder publiseres i Digilist.",
      "image_upload_demo_only",
    );
  const created = await ctx.provider.createRoom(
    {
      ...fields,
      ...(image !== undefined ? { image } : {}),
      imageKind,
    },
    ctx.user!,
  );
  if (imageFile) {
    image = await saveDemoRoomImage(created.id, imageFile);
    imageKind = imageKind ?? "illustrative";
    res.status(201).json(
      await ctx.provider.updateRoom(
        created.id,
        {
          name: created.name,
          capacity: created.capacity,
          description: created.description,
          descriptionEn: created.descriptionEn,
          capacityLabel: created.capacityLabel,
          capacityLabelEn: created.capacityLabelEn,
          requiresApproval: created.requiresApproval,
          amenities: created.amenities,
          arrivalInfo: created.arrivalInfo || "",
          image,
          imageKind,
        },
        ctx.user!,
      ),
    );
    return;
  }
  res.status(201).json(created);
});
app.patch("/api/admin/rooms/:id", async (req, res) => {
  const ctx = await requirePortalAdminContext(req, res);
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
app.post("/api/admin/rooms/:id/portal", async (req, res) => {
  const ctx = await requirePortalAdminContext(req, res);
  const body = z.object({ published: z.boolean() }).parse(req.body);
  res.json(
    await ctx.provider.setRoomPortalPublished(
      String(req.params.id),
      body.published,
      ctx.user!,
    ),
  );
});
app.delete("/api/admin/rooms/:id", async (req, res) => {
  const ctx = await requirePortalAdminContext(req, res);
  await ctx.provider.deleteRoom(String(req.params.id), ctx.user!);
  res.json({ success: true });
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
  if (isAppError(error)) {
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
  if (isPayloadTooLarge(error)) {
    return res.status(413).json({
      code: "invalid_image_size",
      message: translateMessage(locale, "invalid_image_size"),
    });
  }
  const status = error instanceof z.ZodError ? 400 : 502;
  const code =
    error instanceof z.ZodError
      ? "validation_failed"
      : "booking_service_incomplete";
  if (!(error instanceof z.ZodError)) {
    console.error("[api] unhandled", error);
  }
  res.status(status).json({
    code,
    message: translateMessage(locale, code),
  });
});

function isPayloadTooLarge(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { type?: string; status?: number; name?: string };
  return (
    candidate.type === "entity.too.large" ||
    candidate.status === 413 ||
    candidate.name === "PayloadTooLargeError"
  );
}
