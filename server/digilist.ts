import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { createHash } from "node:crypto";
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
  InsightsBlock,
  InsightsBooking,
  Room,
  Search,
  User,
} from "../shared/types";
import { interval } from "../shared/time";
import { AppError } from "../shared/validation";
import { translateMessage } from "../shared/i18n/messages";
import { DEFAULT_LOCALE, type Locale } from "../shared/i18n/locale";
import { collectPaged, INSIGHTS_PAGE_SIZE } from "./insights";
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
  const isMember = raw.tenantId === buildingTenantId;
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
  } catch {
    if (config.access === "members") {
      throw new AppError(
        403,
        "Denne bookingløsningen er for byggets medlemmer. Kontakt administrator for tilgang.",
        "members_only_access",
      );
    }
  }
  session.accessToken = undefined;
  await refreshAccess(session);
}
export class Digilist {
  c: ConvexHttpClient;
  private sources = new Map<string, Row>();
  constructor(private session?: Session) {
    this.c = client(session);
  }
  async rooms(): Promise<Room[]> {
    return Promise.all(
      inventory.map(async (definition) => {
        const source = row(
          await query(this.c, "domain/resources:getBySlug", {
            slug: definition.slug,
            tenantId,
          }),
        );
        const channel =
          source.accessChannel === "tenant_portal"
            ? "tenant_portal"
            : str(row(source.metadata).accessChannel) === "tenant_portal"
              ? "tenant_portal"
              : "marketplace";
        if (
          source.tenantId !== tenantId ||
          !source._id ||
          channel !== "tenant_portal"
        )
          throw new AppError(
            503,
            `Rommet ${definition.name} er ikke tilgjengelig i byggets oppsett.`,
            "room_setup_unavailable",
            { name: definition.name },
          );
        this.sources.set(definition.id, source);
        const images = Array.isArray(source.images) ? source.images : [];
        const image =
          typeof images[0] === "string" ? images[0] : str(row(images[0]).url);
        const liveImage =
          image && /^https:\/\//.test(image) ? image : undefined;
        return {
          ...definition,
          sourceId: str(source._id),
          name: str(source.name, definition.name),
          slug: definition.slug,
          description: str(source.description, definition.description),
          descriptionEn: definition.descriptionEn || "",
          capacity: z.number().int().positive().parse(source.capacity),
          capacityLabel: `${source.capacity} personer`,
          capacityLabelEn: `${source.capacity} people`,
          image: liveImage || definition.image,
          imageKind: liveImage ? "actual" : definition.imageKind,
          amenities: Array.isArray(source.amenities)
            ? source.amenities.flatMap((x) => {
                const name = typeof x === "string" ? x : str(row(x).name);
                return name ? [name] : [];
              })
            : [],
          requiresApproval: Boolean(
            row(source.bookingConfig).approvalRequired ||
            source.requiresApproval,
          ),
          arrivalInfo: str(row(source.metadata).arrivalInfo),
        };
      }),
    );
  }
  async room(id: string) {
    const r = (await this.rooms()).find((r) => r.id === id);
    if (!r)
      throw new AppError(404, "Rommet ble ikke funnet.", "room_not_found");
    return r;
  }
  async availability(
    search: Search,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<Availability[]> {
    const span = interval(search);
    const rooms = await this.rooms();
    return Promise.all(
      rooms.map(async (room) => {
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
      throw new AppError(409, errors.map((e) => str(e.message)).join(" "));
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
      phone: str(guest.phone, str(guest.mobile, str(guest.telephone))),
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
    const rooms = await this.rooms();
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
    const b = this.normalizeBooking(raw, await this.rooms());
    if (!user.isAdmin && b.userId !== user.id)
      throw new AppError(
        404,
        "Bookingen ble ikke funnet.",
        "booking_not_found",
      );
    return b;
  }
  async create(input: BookingInput, user: User, key: string) {
    const room = await this.room(input.roomId);
    const span = interval(input);
    const slot = row(
      await query(this.c, "domain/bookings:validateBookingSlot", {
        resourceId: room.sourceId,
        ...span,
      }),
    );
    if (slot.valid === false)
      throw new AppError(
        409,
        str(slot.reason, "Rommet er ikke ledig."),
        "room_unavailable",
      );
    const idempotencyKey = createHash("sha256")
      .update(`${tenantId}:${user.id}:${key}`)
      .digest("hex");
    const existing = list(
      await query(this.c, "domain/bookings:listMine", {
        userId: user.id,
        limit: 500,
        audience: "tenant_portal",
      }),
    ).find(
      (b) => str(row(b.metadata).moteromIdempotencyKey) === idempotencyKey,
    );
    if (existing) {
      const rooms = await this.rooms();
      return this.normalizeBooking(existing, rooms);
    }
    const notes = [
      input.phone ? `Telefon: ${input.phone}` : "",
      input.title,
      input.notes,
    ]
      .filter(Boolean)
      .join("\n");
    const result = row(
      await mutate(this.c, "domain/bookings:create", {
        tenantId,
        resourceId: room.sourceId,
        userId: user.id,
        startTime: span.startTime,
        endTime: span.endTime,
        notes,
        metadata: {
          title: input.title,
          guestCount: input.people,
          moteromIdempotencyKey: idempotencyKey,
        },
      }),
    );
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
    const rooms = await this.rooms();
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
    const rooms = await this.rooms();
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
        return [
          {
            id: str(raw._id, str(raw.id)),
            roomId: room.id,
            startTime,
            endTime,
            status: str(raw.status, "pending"),
          },
        ];
      }),
    };
  }
  async listBlocksForInsights(user: User): Promise<InsightsBlock[]> {
    this.assertAdmin(user);
    const rooms = await this.rooms();
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
      ...(liveImage ? { images: [{ url: liveImage }] } : {}),
      ...(patch.amenities ? { amenities: patch.amenities } : {}),
      metadata: {
        ...row(source?.metadata),
        ...(patch.arrivalInfo !== undefined
          ? { arrivalInfo: patch.arrivalInfo }
          : {}),
      },
    });
    return this.room(id);
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
}
