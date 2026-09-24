import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  adminEmails,
  config,
  convexUrl,
  httpUrl,
  inventory,
  tenantId,
} from "./config";
import type { Session } from "./session";
import type {
  AdminData,
  Availability,
  Block,
  Booking,
  BookingInput,
  ConversationSummary,
  ConversationThread,
  InsightsBlock,
  InsightsBooking,
  Message,
  Room,
  Search,
  User,
  TenantMember,
} from "../shared/types";
import { interval } from "../shared/time";
import { AppError } from "../shared/validation";
import { enrichBookingConversation } from "./conversationContext";
import { translateMessage } from "../shared/i18n/messages";
import { DEFAULT_LOCALE, type Locale } from "../shared/i18n/locale";
import { collectPaged, INSIGHTS_PAGE_SIZE } from "./insights";
import { assertSameBooking, bookingFingerprint } from "./bookingRetry";
import { presentBuildingMembers } from "../shared/members";
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" ? (value as Row) : {};
const list = (value: unknown): Row[] =>
  (Array.isArray(value)
    ? value
    : Array.isArray(row(value).data)
      ? row(value).data
      : []) as Row[];
const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;

const PORTAL_OPENING_HOURS = [
  { dayIndex: 1, day: "Mandag", open: "08:00", close: "17:00" },
  { dayIndex: 2, day: "Tirsdag", open: "08:00", close: "17:00" },
  { dayIndex: 3, day: "Onsdag", open: "08:00", close: "17:00" },
  { dayIndex: 4, day: "Torsdag", open: "08:00", close: "17:00" },
  { dayIndex: 5, day: "Fredag", open: "08:00", close: "17:00" },
  { dayIndex: 6, day: "Lørdag", open: "00:00", close: "00:00", isClosed: true },
  { dayIndex: 0, day: "Søndag", open: "00:00", close: "00:00", isClosed: true },
];

const PORTAL_BOOKING_CONFIG = {
  bookingModel: "TIME_RANGE",
  slotDurationMinutes: 60,
  minLeadTimeHours: 0,
  maxAdvanceDays: 180,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  approvalRequired: false,
  paymentRequired: false,
  depositPercent: 0,
  cancellationPolicy: "flexible",
  freeCancellationHours: 0,
  allowRecurring: false,
  allowSeasonalLease: false,
  minBookingDurationMinutes: 60,
};

function isTenantPortalRoom(source: Row): boolean {
  const channel = str(
    source.accessChannel,
    str(row(source.metadata).accessChannel, "marketplace"),
  );
  const visibility = str(
    source.visibility,
    str(row(source.metadata).visibility),
  );
  return channel === "tenant_portal" && visibility === "private";
}

/** Digilist status is the publish authority (draft / archived are not bookable). */
function isDigilistPublished(source: Row): boolean {
  const status = str(source.status);
  if (!status) {
    const listing = str(source.listingStatus, "published");
    return ![
      "draft",
      "paused",
      "expired",
      "rejected",
      "deleted",
      "changes_requested",
    ].includes(listing);
  }
  if (["draft", "archived", "deleted", "scheduled"].includes(status))
    return false;
  return status === "published" || status === "active";
}

function portalRoomId(source: Row): string {
  const slug = str(source.slug);
  return inventory.find((item) => item.slug === slug)?.id || slug;
}

function slugFromName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "rom"}-${randomBytes(3).toString("hex")}`;
}
export async function rest(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  idempotencyKey?: string,
): Promise<Row> {
  let response: Response;
  try {
    response = await fetch(`${httpUrl}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      503,
      method === "POST"
        ? "Vi fikk ikke bekreftet svaret. Prøv samme bestilling igjen."
        : "Vi får ikke kontakt med bookingtjenesten. Prøv igjen.",
      method === "POST"
        ? "booking_confirm_uncertain"
        : "booking_service_unreachable",
    );
  }
  const value =
    response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = row(value);
    const digilistDetail = str(
      problem.detail || problem.message || problem.title,
    );
    if (response.status === 401)
      throw new AppError(
        401,
        "Økten er utløpt. Logg inn på nytt.",
        "session_expired",
      );
    if (response.status === 403)
      throw new AppError(
        403,
        "Du har ikke tilgang til denne handlingen.",
        "action_forbidden",
      );
    if (response.status === 409)
      throw new AppError(
        409,
        "Tidspunktet eller bestillingen har endret seg. Kontroller valget ditt.",
        "booking_stale",
      );
    // Prefer Digilist problem detail over a generic catalogued code.
    throw new AppError(
      response.status,
      digilistDetail || "Bookingtjenesten kunne ikke fullføre forespørselen.",
      digilistDetail ? "digilist_request_rejected" : "booking_service_failed",
    );
  }
  return row(value);
}
export function client(session?: Session) {
  const c = new ConvexHttpClient(convexUrl);
  if (session?.accessToken) c.setAuth(session.accessToken);
  return c;
}
export async function query(
  c: ConvexHttpClient,
  name: string,
  args: Row = {},
): Promise<unknown> {
  return c.query(makeFunctionReference<"query">(name), args);
}
export async function mutate(
  c: ConvexHttpClient,
  name: string,
  args: Row,
): Promise<unknown> {
  return c.mutation(makeFunctionReference<"mutation">(name), args);
}
export async function action(
  c: ConvexHttpClient,
  name: string,
  args: Row,
): Promise<unknown> {
  return c.action(makeFunctionReference<"action">(name), args);
}
/**
 * Map Digilist `/auth/me` fields to the portal User after switchTenant.
 * Møterom Admin requires ADMIN_EMAILS and an admin-capable Digilist tenant
 * role on this building tenant. Membership is Digilist tenant membership only.
 */
const ADMIN_TENANT_ROLES = new Set([
  "tenant_admin",
  "saksbehandler",
  "owner",
  "admin",
  "manager",
  "staff",
]);

function isDigilistTenantAdminRole(role: string | null | undefined): boolean {
  return ADMIN_TENANT_ROLES.has((role ?? "").trim().toLowerCase());
}

export function mapDigilistUser(
  raw: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    tenantId?: string | null;
    tenantRole?: string | null;
  },
  buildingTenantId: string = tenantId,
): User {
  const email = raw.email.trim().toLowerCase();
  const isMember = Boolean(
    buildingTenantId &&
    raw.tenantId === buildingTenantId &&
    raw.tenantRole?.trim(),
  );
  const isAdmin =
    isMember &&
    adminEmails.has(email) &&
    isDigilistTenantAdminRole(raw.tenantRole);
  return {
    id: raw.id,
    name: raw.name || raw.email,
    email: raw.email,
    isMember,
    isAdmin,
  };
}

export async function liveUser(session: Session): Promise<User> {
  const result = await rest("/auth/me", "GET", undefined, session.token);
  const user = z
    .object({
      id: z.string(),
      name: z.string().nullable().optional(),
      email: z.string(),
      role: z.string(),
      tenantId: z.string().nullable().optional(),
      tenantRole: z.string().nullable().optional(),
    })
    .parse(result.user);
  return mapDigilistUser(user);
}
export async function refreshAccess(session: Session) {
  if (session.accessToken && (session.expiresAt ?? 0) > Date.now() + 30000)
    return false;
  const result = z
    .object({ accessToken: z.string(), expiresAt: z.number() })
    .parse(await rest("/auth/token", "POST", { sessionToken: session.token }));
  Object.assign(session, result);
  return true;
}
export async function setBuildingContext(session: Session) {
  try {
    await mutate(client(), "auth/sessions:switchTenant", {
      token: session.token,
      tenantId,
    });
  } catch (error) {
    // A verified outsider may sign in to request access. Infrastructure and
    // invalid-session errors must not masquerade as a successful tenant switch.
    if (
      !(error instanceof ConvexError) ||
      row(error.data).type !== "auth/forbidden_tenant"
    )
      throw error;
  }
  session.accessToken = undefined;
  await refreshAccess(session);
}
export class Digilist {
  c: ConvexHttpClient;
  private sources = new Map<string, Row>();
  // Scoped to one HTTP request/session; never share private results globally.
  private roomRequests = new Map<string, Promise<Room>>();
  constructor(private session?: Session) {
    this.c = client(session);
  }
  async allRooms(): Promise<Room[]> {
    let listed: Row[] = [];
    try {
      listed = list(
        await query(this.c, "domain/resources:list", {
          tenantId,
          limit: 200,
        }),
      ).filter(
        (source) =>
          source.tenantId === tenantId &&
          isTenantPortalRoom(source) &&
          str(source.status) !== "deleted" &&
          str(source._id),
      );
    } catch {
      listed = [];
    }
    if (listed.length) {
      return listed.map((source) => {
        const room = this.mapSourceToRoom(source);
        this.sources.set(room.id, source);
        return room;
      });
    }
    // Fallback when Digilist list is empty or unavailable for this session.
    return Promise.all(inventory.map((definition) => this.room(definition.id)));
  }
  async rooms(): Promise<Room[]> {
    return (await this.allRooms()).filter((room) => room.portalPublished);
  }
  async room(id: string): Promise<Room> {
    const definition = inventory.find(
      (item) => item.id === id || item.slug === id,
    );
    const slug = definition?.slug || id;
    let request = this.roomRequests.get(id) || this.roomRequests.get(slug);
    if (!request) {
      request = (async () => {
        const source = row(
          await query(this.c, "domain/resources:getBySlug", {
            slug,
            tenantId,
          }),
        );
        if (!source._id)
          throw new AppError(404, "Rommet ble ikke funnet.", "room_not_found");
        if (source.tenantId !== tenantId || !isTenantPortalRoom(source))
          throw new AppError(
            503,
            `Rommet ${str(source.name, definition?.name || slug)} er ikke tilgjengelig i byggets oppsett.`,
            "room_setup_unavailable",
            { name: str(source.name, definition?.name || slug) },
          );
        const room = this.mapSourceToRoom(source, definition);
        this.sources.set(room.id, source);
        return room;
      })();
      this.roomRequests.set(id, request);
      this.roomRequests.set(slug, request);
    }
    return request;
  }
  private mapSourceToRoom(source: Row, definition?: Room): Room {
    const slug = str(source.slug, definition?.slug || "");
    const seed = definition || inventory.find((item) => item.slug === slug);
    const id = seed?.id || slug;
    const images = Array.isArray(source.images) ? source.images : [];
    const image =
      typeof images[0] === "string" ? images[0] : str(row(images[0]).url);
    const liveImage = image && /^https:\/\//.test(image) ? image : undefined;
    const portal = row(row(source.metadata).moterom);
    const capacity = z
      .number()
      .int()
      .positive()
      .parse(source.capacity ?? seed?.capacity ?? 1);
    return {
      id,
      name: str(source.name, seed?.name || slug),
      slug,
      sourceId: str(source._id),
      description: str(source.description, seed?.description || ""),
      descriptionEn: str(portal.descriptionEn, seed?.descriptionEn || ""),
      capacity,
      capacityLabel:
        str(portal.capacityLabel) ||
        seed?.capacityLabel ||
        `${capacity} personer`,
      capacityLabelEn:
        str(portal.capacityLabelEn) ||
        seed?.capacityLabelEn ||
        `${capacity} people`,
      image: liveImage || seed?.image,
      imageKind:
        portal.imageUrl === (liveImage || seed?.image) &&
        ["actual", "illustrative"].includes(str(portal.imageKind))
          ? (portal.imageKind as Room["imageKind"])
          : liveImage
            ? "illustrative"
            : seed?.imageKind,
      amenities: Array.isArray(source.amenities)
        ? source.amenities.flatMap((x) => {
            const name = typeof x === "string" ? x : str(row(x).name);
            return name ? [name] : [];
          })
        : seed?.amenities || [],
      requiresApproval: Boolean(
        row(source.bookingConfig).approvalRequired || source.requiresApproval,
      ),
      portalPublished: isDigilistPublished(source),
      arrivalInfo: str(row(source.metadata).arrivalInfo),
      nameNeedsConfirmation: seed?.nameNeedsConfirmation,
    };
  }
  private assertPortalPublished(room: Room) {
    if (!room.portalPublished)
      throw new AppError(404, "Rommet ble ikke funnet.", "room_not_found");
  }
  async availability(
    search: Search,
    locale: Locale = DEFAULT_LOCALE,
    roomId?: string,
  ): Promise<Availability[]> {
    const span = interval(search);
    const rooms = roomId ? [await this.room(roomId)] : await this.rooms();
    return Promise.all(
      rooms.map(async (room) => {
        if (!room.portalPublished)
          return {
            roomId: room.id,
            state: "unavailable" as const,
            reason: translateMessage(locale, "room_not_found"),
          };
        if (span.startTime < Date.now() || room.capacity < search.people)
          return {
            roomId: room.id,
            state: "unavailable" as const,
            reason:
              room.capacity < search.people
                ? translateMessage(locale, "too_many_participants")
                : translateMessage(locale, "time_past"),
          };
        try {
          // Single-room validator preserves upstream failures and minimum-duration rules.
          const result = row(
            await query(this.c, "domain/bookings:validateBookingSlot", {
              resourceId: room.sourceId,
              ...span,
            }),
          );
          if (typeof result.valid !== "boolean")
            throw new Error("Unexpected availability response");
          return {
            roomId: room.id,
            state: result.valid
              ? ("available" as const)
              : ("unavailable" as const),
            reason: result.valid
              ? undefined
              : str(
                  result.reason,
                  translateMessage(locale, "slot_not_bookable"),
                ),
          };
        } catch {
          return {
            roomId: room.id,
            state: "error" as const,
            reason: translateMessage(locale, "availability_fetch_failed"),
          };
        }
      }),
    );
  }
  async quote(roomId: string, search: Search, user: User) {
    const room = await this.room(roomId);
    const raw = row(
      await query(this.c, "domain/pricing:quote", {
        resourceId: room.sourceId,
        slots: [interval(search)],
        attendees: search.people,
        userId: user.id,
        bookingMode: "SLOTS",
      }),
    );
    const issues = list(raw.validation);
    const errors = issues.filter((r) => r.severity === "error");
    if (errors.length)
      throw new AppError(
        409,
        errors
          .map((e) => str(e.message) || str(e.code) || str(e.title))
          .filter(Boolean)
          .join(" ") ||
          "Pristilbudet kunne ikke beregnes for dette tidspunktet.",
        "quote_rejected",
      );
    const priceOnRequest = issues.some((r) =>
      ["PRICE_ON_REQUEST", "NO_PRICING_CONFIGURED"].includes(str(r.code)),
    );
    const total = priceOnRequest
      ? null
      : z.number().nonnegative().parse(row(raw.summary).total);
    const currency = str(raw.currency, "NOK");
    if (priceOnRequest || total === null || total > 0)
      throw new AppError(
        409,
        "Dette rommet kan ikke bestilles med betaling i møteromsportalen. Kontakt administrator.",
        "skb_internal_booking_only",
      );
    return {
      total: 0,
      currency,
      priceOnRequest: false,
      requiresApproval: room.requiresApproval,
      paymentMode: "none" as const,
      raw,
    };
  }
  private normalizeBooking(raw: Row, rooms: Room[]): Booking {
    const room = rooms.find((r) => r.sourceId === raw.resourceId);
    if (!room || raw.tenantId !== tenantId)
      throw new AppError(
        404,
        "Bookingen tilhører ikke dette bygget.",
        "booking_wrong_building",
      );
    const meta = row(raw.metadata);
    const guest = row(raw.guestInfo);
    return {
      id: str(raw._id, str(raw.id)),
      reference: str(raw.bookingRef, str(raw.bookingNumber, str(raw._id))),
      roomId: room.id,
      roomName: room.name,
      userId: str(raw.userId),
      name: str(raw.userName, str(guest.name)),
      email: str(raw.userEmail, str(guest.email)),
      phone: str(
        meta.moteromPhone,
        str(guest.phone, str(guest.mobile, str(guest.telephone))),
      ),
      startTime: z.number().parse(raw.startTime),
      endTime: z.number().parse(raw.endTime),
      people: Number(meta.guestCount ?? meta.attendees ?? 1),
      title: str(meta.title),
      notes: str(raw.notes),
      status: str(raw.status, "pending"),
      totalPrice: typeof raw.totalPrice === "number" ? raw.totalPrice : null,
      currency: str(raw.currency, "NOK"),
      paymentRequired:
        Number(raw.totalPrice ?? 0) >
        Number(raw.paidAmount ?? meta.paidAmount ?? 0),
      cancellationAllowed:
        typeof raw.canCancel === "boolean" ? raw.canCancel : undefined,
      cancellationMessage: str(raw.cancellationMessage),
    };
  }
  async bookings(user: User) {
    const rooms = await this.allRooms();
    const data = list(
      await query(this.c, "domain/bookings:listMine", {
        userId: user.id,
        limit: 500,
        audience: "tenant_portal",
      }),
    );
    return data
      .filter(
        (b) =>
          b.tenantId === tenantId &&
          rooms.some((r) => r.sourceId === b.resourceId),
      )
      .map((b) => this.normalizeBooking(b, rooms));
  }
  async booking(id: string, user: User) {
    const raw = row(
      await query(this.c, "domain/bookings:get", {
        id,
        sessionToken: this.session?.token,
      }),
    );
    const b = this.normalizeBooking(raw, await this.allRooms());
    if (!user.isAdmin && b.userId !== user.id)
      throw new AppError(
        404,
        "Bookingen ble ikke funnet.",
        "booking_not_found",
      );
    return b;
  }
  private requestKey(user: User, key: string) {
    return createHash("sha256")
      .update(`${tenantId}:${user.id}:${key}`)
      .digest("hex");
  }
  private bookingNotes(input: BookingInput) {
    return [
      input.phone ? `Telefon: ${input.phone}` : "",
      input.title,
      input.notes,
    ]
      .filter(Boolean)
      .join("\n");
  }
  async replay(
    input: BookingInput,
    user: User,
    key: string,
  ): Promise<Booking | undefined> {
    const idempotencyKey = this.requestKey(user, key);
    const existing = list(
      await query(this.c, "domain/bookings:listMine", {
        userId: user.id,
        limit: 500,
        audience: "tenant_portal",
      }),
    ).find(
      (b) =>
        b.tenantId === tenantId &&
        b.userId === user.id &&
        str(row(b.metadata).moteromIdempotencyKey) === idempotencyKey,
    );
    if (existing) {
      const room = await this.room(input.roomId);
      const span = interval(input);
      const meta = row(existing.metadata);
      assertSameBooking(
        existing.resourceId === room.sourceId &&
          existing.startTime === span.startTime &&
          existing.endTime === span.endTime &&
          (meta.moteromFingerprint
            ? meta.moteromFingerprint === bookingFingerprint(input, user.id)
            : Number(meta.guestCount ?? 1) === input.people &&
              str(meta.title) === input.title &&
              str(existing.notes) === this.bookingNotes(input)),
      );
      return this.normalizeBooking(existing, [room]);
    }
  }
  async create(input: BookingInput, user: User, key: string) {
    const existing = await this.replay(input, user, key);
    if (existing) return existing;
    const room = await this.room(input.roomId);
    this.assertPortalPublished(room);
    const span = interval(input);
    const slot = row(
      await query(this.c, "domain/bookings:validateBookingSlot", {
        resourceId: room.sourceId,
        ...span,
      }),
    );
    if (slot.valid !== true)
      throw new AppError(
        slot.valid === false ? 409 : 503,
        str(slot.reason, "Rommet er ikke ledig."),
        slot.valid === false ? "room_unavailable" : "availability_fetch_failed",
      );
    let result: Row;
    try {
      result = row(
        await mutate(this.c, "domain/bookings:create", {
          tenantId,
          resourceId: room.sourceId,
          userId: user.id,
          startTime: span.startTime,
          endTime: span.endTime,
          notes: this.bookingNotes(input),
          metadata: {
            title: input.title,
            guestCount: input.people,
            moteromIdempotencyKey: this.requestKey(user, key),
            moteromFingerprint: bookingFingerprint(input, user.id),
            moteromPhone: input.phone || "",
          },
        }),
      );
    } catch (error) {
      // The mutation may have committed before its response was lost. A read
      // can reconcile that result; never send a second write in this catch.
      const committed = await this.replay(input, user, key).catch(
        () => undefined,
      );
      if (committed) return committed;
      throw error;
    }
    const b = await this.booking(z.string().parse(result.id), user);
    return {
      ...b,
      phone: input.phone || b.phone,
    };
  }
  async updateBooking(
    id: string,
    op: "cancel" | "approve" | "reject",
    user: User,
  ) {
    await this.booking(id, user);
    if (op !== "cancel" && !user.isAdmin)
      throw new AppError(
        403,
        "Du har ikke administratortilgang.",
        "admin_required",
      );
    if (op === "cancel" && !user.isAdmin)
      await rest(
        `/me/bookings/${encodeURIComponent(id)}/cancel`,
        "POST",
        {},
        this.session?.accessToken,
      );
    else
      await mutate(this.c, `domain/bookings:${op}`, {
        id,
        [op === "cancel"
          ? "cancelledBy"
          : op === "approve"
            ? "approvedBy"
            : "rejectedBy"]: user.id,
      });
    return this.booking(id, user);
  }
  async requestEdit(id: string, search: Search, user: User) {
    const b = await this.booking(id, user);
    const quote = await this.quote(b.roomId, search, user);
    const span = interval(search);
    if (quote.total === null)
      throw new AppError(
        409,
        "Kontakt utleier for å endre en booking med avtalt pris.",
        "edit_agreed_price",
      );
    await mutate(this.c, "domain/bookings:requestBookingEdit", {
      bookingId: id,
      requestedBy: user.id,
      proposedSlots: [span],
      proposedStartTime: span.startTime,
      proposedEndTime: span.endTime,
      proposedAttendees: search.people,
      proposedTotalPrice: quote.total,
      proposedMvaAmount: Number(row(quote.raw.summary).tax ?? 0),
      reason: "Endring forespurt fra møteromsportalen.",
    });
    return { ...b, editRequested: true };
  }
  async admin(user: User): Promise<AdminData> {
    this.assertAdmin(user);
    const rooms = await this.allRooms();
    const [bookings, blocks] = await Promise.all([
      query(this.c, "domain/bookings:list", {
        tenantId,
        callerId: user.id,
        limit: 1000,
      }),
      query(this.c, "domain/blocks:list", { tenantId, status: "active" }),
    ]);
    return {
      rooms,
      bookings: list(bookings)
        .filter((b) => rooms.some((r) => r.sourceId === b.resourceId))
        .map((b) => this.normalizeBooking(b, rooms)),
      blocks: list(blocks).flatMap((b) => {
        const room = rooms.find((r) => r.sourceId === b.resourceId);
        return room
          ? [
              {
                id: str(b._id, str(b.id)),
                roomId: room.id,
                title: str(b.title),
                startTime: Number(b.startDate),
                endTime: Number(b.endDate),
              },
            ]
          : [];
      }),
      truncated: list(bookings).length >= 1000,
    };
  }
  async listForInsights(
    user: User,
    opts: { fetchFrom: number; fetchTo: number },
  ): Promise<{ bookings: InsightsBooking[]; truncated: boolean }> {
    this.assertAdmin(user);
    const rooms = await this.allRooms();
    const mapped = await collectPaged(async (startAfter) => {
      const rows = list(
        await query(this.c, "domain/bookings:list", {
          tenantId,
          callerId: user.id,
          startAfter,
          startBefore: opts.fetchTo - 1,
          limit: INSIGHTS_PAGE_SIZE,
        }),
      );
      return rows.map((raw) => ({
        id: str(raw._id, str(raw.id)),
        startTime: Number(raw.startTime),
        raw,
      }));
    }, opts.fetchFrom);
    return {
      truncated: mapped.truncated,
      bookings: mapped.items.flatMap(({ raw }) => {
        const room = rooms.find((r) => r.sourceId === raw.resourceId);
        if (!room || raw.tenantId !== tenantId) return [];
        const startTime = Number(raw.startTime);
        const endTime = Number(raw.endTime);
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return [];
        if (endTime <= opts.fetchFrom || startTime >= opts.fetchTo) return [];
        const guest = row(raw.guestInfo);
        return [
          {
            id: str(raw._id, str(raw.id)),
            roomId: room.id,
            startTime,
            endTime,
            status: str(raw.status, "pending"),
            email: str(raw.userEmail, str(guest.email)),
          },
        ];
      }),
    };
  }
  async listBlocksForInsights(user: User): Promise<InsightsBlock[]> {
    this.assertAdmin(user);
    const rooms = await this.allRooms();
    const blocks = list(
      await query(this.c, "domain/blocks:list", { tenantId, status: "active" }),
    );
    return blocks.flatMap((b) => {
      const room = rooms.find((r) => r.sourceId === b.resourceId);
      return room
        ? [
            {
              id: str(b._id, str(b.id)),
              roomId: room.id,
              title: str(b.title),
              startTime: Number(b.startDate),
              endTime: Number(b.endDate),
            },
          ]
        : [];
    });
  }
  assertAdmin(user: User) {
    if (!user.isAdmin)
      throw new AppError(
        403,
        "Du har ikke administratortilgang til dette bygget.",
        "admin_building_required",
      );
  }
  async members(user: User): Promise<TenantMember[]> {
    this.assertAdmin(user);
    // Digilist binds actorId to the authenticated session and checks its role.
    const result = z
      .array(
        z.object({
          userId: z.string(),
          name: z.string().nullable(),
          email: z.string().nullable(),
          role: z.string(),
          status: z.enum(["active", "invited"]),
        }),
      )
      .parse(
        await query(this.c, "domain/tenantTeam:listMembers", {
          tenantId,
          actorId: user.id,
        }),
      );
    return presentBuildingMembers(
      result.map((member) => ({
        ...member,
        name: member.name || member.email || "",
        email: member.email || "",
      })),
    );
  }
  async ensureActiveBooker(email: string, name: string, user: User) {
    this.assertAdmin(user);
    try {
      await mutate(this.c, "domain/tenantTeam:ensureActiveBooker", {
        tenantId,
        actorId: user.id,
        email,
        name,
      });
    } catch {
      throw new AppError(
        409,
        "Aktivt medlemskap må først bekreftes i Digilist. Forespørselen er fortsatt åpen.",
        "membership_not_active",
      );
    }
  }
  async updateRoom(
    id: string,
    patch: {
      name: string;
      capacity: number;
      description: string;
      descriptionEn?: string;
      capacityLabel?: string;
      capacityLabelEn?: string;
      requiresApproval: boolean;
      image?: string;
      imageKind?: "illustrative" | "actual";
      amenities?: string[];
      arrivalInfo?: string;
    },
    user: User,
  ) {
    this.assertAdmin(user);
    const room = await this.room(id);
    const source = this.sources.get(id);
    const image = patch.image?.trim();
    const liveImage = image && /^https:\/\//.test(image) ? image : undefined;
    if (image && !liveImage && image !== room.image)
      throw new AppError(
        400,
        "Bruk en HTTPS-adresse til bildet.",
        "invalid_image_url",
      );
    const currentImages = Array.isArray(source?.images) ? source.images : [];
    if (image === "" && currentImages.length > 1)
      throw new AppError(
        409,
        "Administrer rommets bildegalleri i Digilist.",
        "image_gallery_managed_in_digilist",
      );
    await mutate(this.c, "domain/resources:update", {
      id: room.sourceId,
      updatedBy: user.id,
      name: patch.name,
      capacity: patch.capacity,
      description: patch.description,
      requiresApproval: patch.requiresApproval,
      bookingConfig: {
        ...row(source?.bookingConfig),
        approvalRequired: patch.requiresApproval,
      },
      // Content-only saves must not replace variants or drop other gallery photos.
      ...(image === ""
        ? { images: [] }
        : liveImage && liveImage !== room.image
          ? { images: [{ url: liveImage }, ...currentImages.slice(1)] }
          : {}),
      ...(patch.amenities ? { amenities: patch.amenities } : {}),
      metadata: {
        ...row(source?.metadata),
        moterom: {
          ...row(row(source?.metadata).moterom),
          ...(patch.descriptionEn !== undefined
            ? { descriptionEn: patch.descriptionEn }
            : {}),
          ...(patch.capacityLabel !== undefined
            ? { capacityLabel: patch.capacityLabel }
            : {}),
          ...(patch.capacityLabelEn !== undefined
            ? { capacityLabelEn: patch.capacityLabelEn }
            : {}),
          ...(patch.imageKind !== undefined || image === ""
            ? {
                imageKind: image === "" ? "illustrative" : patch.imageKind,
                imageUrl:
                  image === ""
                    ? inventory.find((item) => item.id === id)?.image || ""
                    : liveImage || room.image || "",
              }
            : {}),
        },
        ...(patch.arrivalInfo !== undefined
          ? { arrivalInfo: patch.arrivalInfo }
          : {}),
      },
    });
    this.roomRequests.delete(id);
    return this.room(id);
  }
  async setRoomPortalPublished(id: string, published: boolean, user: User) {
    this.assertAdmin(user);
    const room = await this.room(id);
    if (!room.sourceId)
      throw new AppError(
        503,
        "Rommet er ikke tilgjengelig i byggets oppsett.",
        "room_setup_unavailable",
      );
    if (published) {
      await mutate(this.c, "domain/resources:update", {
        id: room.sourceId,
        updatedBy: user.id,
        status: "published",
      });
    } else {
      await mutate(this.c, "domain/resources:unpublish", {
        id: room.sourceId,
        unpublishedBy: user.id,
      });
    }
    this.roomRequests.delete(id);
    this.roomRequests.delete(room.slug);
    return this.room(id);
  }
  async createRoom(
    input: {
      name: string;
      capacity: number;
      description: string;
      descriptionEn?: string;
      capacityLabel?: string;
      capacityLabelEn?: string;
      requiresApproval: boolean;
      amenities?: string[];
      arrivalInfo?: string;
      image?: string;
      imageKind?: "illustrative" | "actual";
    },
    user: User,
  ): Promise<Room> {
    this.assertAdmin(user);
    const name = input.name.trim();
    if (!name)
      throw new AppError(400, "Skriv inn et romnavn.", "room_name_required");
    const capacity = z.number().int().positive().parse(input.capacity);
    const slug = slugFromName(name);
    const description = input.description.trim() || name;
    const image = input.image?.trim();
    const liveImage = image && /^https:\/\//.test(image) ? image : undefined;
    if (image && !liveImage)
      throw new AppError(
        400,
        "Bruk en HTTPS-adresse til bildet.",
        "invalid_image_url",
      );
    const capacityLabel = input.capacityLabel?.trim() || `${capacity} personer`;
    const capacityLabelEn =
      input.capacityLabelEn?.trim() || `${capacity} people`;
    let created: Row;
    try {
      created = row(
        await mutate(this.c, "domain/resources:create", {
          tenantId,
          actorId: user.id,
          ownerId: user.id,
          name,
          slug,
          description,
          fullDescription: description,
          categoryKey: "LOKALER",
          timeMode: "PERIOD",
          status: "draft",
          requiresApproval: input.requiresApproval,
          capacity,
          visibility: "private",
          accessChannel: "tenant_portal",
          images: liveImage ? [{ url: liveImage }] : [],
          amenities: input.amenities || [],
          pricing: { basePrice: 0, currency: "NOK", unit: "hour" },
          bookingConfig: {
            ...PORTAL_BOOKING_CONFIG,
            approvalRequired: input.requiresApproval,
          },
          openingHours: PORTAL_OPENING_HOURS,
          slotDurationMinutes: 60,
          metadata: {
            moterom: {
              descriptionEn: input.descriptionEn?.trim() || "",
              capacityLabel,
              capacityLabelEn,
              ...(input.imageKind || liveImage
                ? {
                    imageKind: input.imageKind || "illustrative",
                    imageUrl: liveImage || "",
                  }
                : {}),
            },
            ...(input.arrivalInfo?.trim()
              ? { arrivalInfo: input.arrivalInfo.trim() }
              : {}),
          },
        }),
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      throw new AppError(
        502,
        text || "Rommet kunne ikke opprettes i Digilist.",
        "room_create_failed",
      );
    }
    const sourceId = str(created.id, str(created._id));
    if (!sourceId)
      throw new AppError(
        502,
        "Rommet kunne ikke opprettes i Digilist.",
        "room_create_failed",
      );
    try {
      await mutate(this.c, "domain/pricing:create", {
        tenantId,
        userId: user.id,
        resourceId: sourceId,
        priceType: "hourly",
        basePrice: 0,
        currency: "NOK",
        pricePerHour: 0,
        slotDurationMinutes: 60,
        taxRate: 0,
        taxIncluded: true,
      });
    } catch {
      // Quote may still succeed from resource pricing payload; do not roll back create.
    }
    this.roomRequests.clear();
    this.sources.clear();
    return this.room(slug);
  }
  async createBlock(roomId: string, search: Search, title: string, user: User) {
    this.assertAdmin(user);
    const room = await this.room(roomId);
    const span = interval(search);
    const result = row(
      await query(this.c, "domain/blocks:checkAvailability", {
        resourceId: room.sourceId,
        ...span,
      }),
    );
    if (result.isAvailable !== true)
      throw new AppError(
        409,
        "Tidsrommet overlapper en booking eller blokkering.",
        "interval_overlaps",
      );
    return mutate(this.c, "domain/blocks:create", {
      tenantId,
      resourceId: room.sourceId,
      title,
      startDate: span.startTime,
      endDate: span.endTime,
      allDay: false,
      recurring: false,
      visibility: "private",
      createdBy: user.id,
    });
  }
  async removeBlock(id: string, user: User) {
    this.assertAdmin(user);
    const data = await this.admin(user);
    if (!data.blocks.some((b) => b.id === id))
      throw new AppError(
        404,
        "Blokkeringen ble ikke funnet.",
        "block_not_found",
      );
    return mutate(this.c, "domain/blocks:remove", { id, actorId: user.id });
  }
  private messagingFailure(error: unknown): never {
    const text = error instanceof Error ? error.message : "";
    if (/MODULE_DISABLED|not enabled for this tenant/i.test(text))
      throw new AppError(
        503,
        "Meldinger er ikke tilgjengelig for dette bygget akkurat nå.",
        "messaging_unavailable",
      );
    if (/Forbidden|not authorized/i.test(text))
      throw new AppError(
        403,
        "Du har ikke tilgang til denne handlingen.",
        "action_forbidden",
      );
    throw new AppError(
      502,
      "Bookingtjenesten kunne ikke fullføre handlingen. Prøv igjen.",
      "booking_service_incomplete",
    );
  }
  private mapConversation(raw: Row, rooms: Room[]): ConversationSummary | null {
    const bookingId = str(raw.bookingId) || undefined;
    const resourceId = str(raw.resourceId);
    const room = rooms.find(
      (r) => r.sourceId === resourceId || r.name === str(raw.listingName),
    );
    const roomName = str(
      raw.listingName,
      room?.name || str(raw.displaySubject),
    );
    const id = str(raw._id, str(raw.id));
    if (!id) return null;
    const base: ConversationSummary = {
      id: str(raw._id, str(raw.id)),
      kind: "booking",
      bookingId,
      roomId: room?.id,
      roomName,
      subject: str(raw.displaySubject, str(raw.subject, roomName || "Melding")),
      preview: str(raw.lastMessagePreview, str(raw.preview)),
      updatedAt: Number(
        raw.lastMessageAt ?? raw.updatedAt ?? raw._creationTime ?? Date.now(),
      ),
      unread: Number(raw.unreadCount ?? raw.unread ?? 0),
      customerName: str(raw.userName),
    };
    if (room) {
      base.context = {
        roomId: room.id,
        roomName: room.name,
        image: room.image,
        imageKind: room.imageKind,
        capacity: room.capacity,
        capacityLabel: room.capacityLabel,
        capacityLabelEn: room.capacityLabelEn,
        bookingId: bookingId || "",
      };
    }
    return base;
  }
  private async enrichConversation(
    conversation: ConversationSummary | null,
    user: User,
  ): Promise<ConversationSummary | null> {
    if (!conversation?.bookingId) return conversation;
    try {
      const booking = await this.booking(conversation.bookingId, user);
      return enrichBookingConversation(
        conversation,
        booking,
        await this.allRooms(),
      );
    } catch {
      return conversation;
    }
  }
  private mapMessage(raw: Row, conversationId: string): Message {
    return {
      id: str(raw._id, str(raw.id)),
      conversationId,
      senderId: str(raw.senderId),
      senderName: str(raw.senderName, str(raw.senderType, "Ukjent")),
      fromAdmin: str(raw.senderType) === "admin",
      content: str(raw.content),
      createdAt: Number(raw._creationTime ?? raw.createdAt ?? Date.now()),
    };
  }
  private async loadMessages(
    conversationId: string,
    user: User,
  ): Promise<Message[]> {
    try {
      return list(
        await query(this.c, "domain/messaging:listMessages", {
          actorId: user.id,
          conversationId,
          visibilityFilter: user.isAdmin ? "all" : "public",
        }),
      )
        .filter((m) => str(m.visibility) !== "internal")
        .map((m) => this.mapMessage(m, conversationId));
    } catch (error) {
      this.messagingFailure(error);
    }
  }
  async inbox(user: User): Promise<ConversationSummary[]> {
    const rooms = await this.allRooms();
    try {
      const rows = user.isAdmin
        ? list(
            await query(this.c, "domain/messaging:listConversationsForTenant", {
              tenantId,
              actorId: user.id,
              limit: 100,
            }),
          )
        : list(
            await query(this.c, "domain/messaging:listConversations", {
              tenantId,
              userId: user.id,
              limit: 100,
            }),
          );
      return rows
        .map((row) => this.mapConversation(row, rooms))
        .filter((c): c is ConversationSummary => Boolean(c?.id))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      this.messagingFailure(error);
    }
  }
  async bookingThread(
    bookingId: string,
    user: User,
  ): Promise<ConversationThread> {
    await this.booking(bookingId, user);
    try {
      const raw = row(
        await query(this.c, "domain/messaging:getConversationByBooking", {
          actorId: user.id,
          tenantId,
          bookingId,
        }),
      );
      const id = str(raw._id, str(raw.id));
      if (!id) return { conversation: null, messages: [] };
      try {
        await mutate(this.c, "domain/messaging:markMessagesAsRead", {
          conversationId: id,
          userId: user.id,
        });
      } catch {
        /* unread is optional */
      }
      return {
        conversation: await this.enrichConversation(
          this.mapConversation(raw, await this.allRooms()),
          user,
        ),
        messages: await this.loadMessages(id, user),
      };
    } catch (error) {
      this.messagingFailure(error);
    }
  }
  async conversationThread(
    id: string,
    user: User,
  ): Promise<ConversationThread> {
    try {
      const raw = row(
        await query(this.c, "domain/messaging:getConversation", {
          actorId: user.id,
          id,
        }),
      );
      if (!str(raw._id, str(raw.id)))
        throw new AppError(
          404,
          "Samtalen ble ikke funnet.",
          "conversation_not_found",
        );
      if (raw.tenantId && str(raw.tenantId) !== tenantId)
        throw new AppError(
          404,
          "Samtalen ble ikke funnet.",
          "conversation_not_found",
        );
      if (!user.isAdmin) {
        const bookingId = str(raw.bookingId);
        if (!bookingId)
          throw new AppError(
            404,
            "Samtalen ble ikke funnet.",
            "conversation_not_found",
          );
        await this.booking(bookingId, user);
      }
      try {
        await mutate(this.c, "domain/messaging:markMessagesAsRead", {
          conversationId: id,
          userId: user.id,
        });
      } catch {
        /* unread is optional */
      }
      return {
        conversation: await this.enrichConversation(
          this.mapConversation(raw, await this.allRooms()),
          user,
        ),
        messages: await this.loadMessages(id, user),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.messagingFailure(error);
    }
  }
  async sendBookingMessage(
    bookingId: string,
    content: string,
    user: User,
    clientMessageId?: string,
  ): Promise<ConversationThread> {
    const booking = await this.booking(bookingId, user);
    const room = await this.room(booking.roomId);
    try {
      const created = row(
        await mutate(
          this.c,
          "domain/messaging:getOrCreateConversationForBooking",
          {
            tenantId,
            bookingId,
            userId: user.id,
            resourceId: room.sourceId,
          },
        ),
      );
      const conversationId = str(created.conversationId);
      if (!conversationId)
        throw new AppError(
          502,
          "Bookingtjenesten kunne ikke fullføre handlingen. Prøv igjen.",
          "booking_service_incomplete",
        );
      await mutate(this.c, "domain/messaging:sendMessage", {
        tenantId,
        conversationId,
        senderId: user.id,
        senderType: user.isAdmin ? "admin" : "user",
        visibility: "public",
        content,
        ...(clientMessageId ? { clientMessageId } : {}),
      });
      return this.bookingThread(bookingId, user);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.messagingFailure(error);
    }
  }
  async sendConversationMessage(
    id: string,
    content: string,
    user: User,
    clientMessageId?: string,
  ): Promise<ConversationThread> {
    await this.conversationThread(id, user);
    try {
      await mutate(this.c, "domain/messaging:sendMessage", {
        tenantId,
        conversationId: id,
        senderId: user.id,
        senderType: user.isAdmin ? "admin" : "user",
        visibility: "public",
        content,
        ...(clientMessageId ? { clientMessageId } : {}),
      });
      return this.conversationThread(id, user);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.messagingFailure(error);
    }
  }
}
