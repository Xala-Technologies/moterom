export interface Room {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  capacityLabel: string;
  capacityLabelEn: string;
  description: string;
  descriptionEn: string;
  image?: string;
  imageKind?: "illustrative" | "actual";
  amenities: string[];
  requiresApproval: boolean;
  /** When false, hidden from customer catalogue; admin still sees it. Absent means published. */
  portalPublished?: boolean;
  nameNeedsConfirmation?: boolean;
  arrivalInfo?: string;
  sourceId?: string;
  /** Weekday opening time HH:mm (Mon–Fri). Digilist owns full schedule. */
  openTime?: string;
  /** Weekday closing time HH:mm (Mon–Fri). Digilist owns full schedule. */
  closeTime?: string;
  /** When true, only internal demo users / admins may see or book the room. */
  internalOnly?: boolean;
  /** Cancellation notice period in days (demo terms). */
  cancelDeadlineDays?: number;
  /**
   * Illustrative hourly rates for the public catalogue and demo quotes.
   * `member` defaults to `internal` when omitted.
   */
  demoHourlyPrices?: {
    internal: number;
    member?: number;
    ideal: number;
    external: number;
  };
}
export interface Search {
  date: string;
  start: string;
  end: string;
  people: number;
}
export type AvailabilityState = "available" | "unavailable" | "error";
export interface Availability {
  roomId: string;
  state: AvailabilityState;
  reason?: string;
}
export interface TimeSlot {
  start: string;
  end: string;
  state: AvailabilityState;
  reason?: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isMember: boolean;
  /** Digilist tenant role on this building, when known. */
  tenantRole?: string;
  /**
   * Portal capability derived from Digilist tenant role and/or Brukere assignment.
   * `full` = rooms, users, settings; `operations` = bookings and day-to-day.
   */
  adminAccess?: "full" | "operations";
  /** Effective portal role shown and edited on Admin → Brukere. */
  portalRole?: "member" | "operations" | "full";
  /**
   * Server-assigned demo price group. Never accept this from the client body.
   * Prefer organisation entitlements when booking on behalf of an org.
   */
  priceGroup?: PriceCategory;
}

/** Demo / FHH customer price categories derived from org entitlements. */
export type PriceCategory = "internal" | "member" | "ideal" | "external";

export type RegistryStatus =
  "verified" | "not_registered" | "verification_failed" | "unchecked";

export type RegistrySource = "brreg" | "manual_fhh" | "demo_fixture" | "none";

export type MembershipStatus = "pending" | "approved" | "rejected" | "revoked";

export type OrganizationRelationKind = "member_of";

export interface Organization {
  id: string;
  organizationNumber: string;
  name: string;
  isInternalTenant: boolean;
  registryStatus: RegistryStatus;
  registrySource: RegistrySource;
  registryCheckedAt: number | null;
  /** FHH manual ideal eligibility — does not overwrite registryStatus. */
  manualIdealEligible: boolean;
  registrySnapshot?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationRelation {
  id: string;
  childOrganizationId: string;
  parentOrganizationId: string;
  kind: OrganizationRelationKind;
  status: MembershipStatus;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  role: "representative" | "org_admin";
  status: MembershipStatus;
  createdAt: number;
  updatedAt: number;
}

export interface MembershipRequest {
  id: string;
  kind: "represent_organization" | "organization_relation";
  organizationId?: string;
  parentOrganizationId?: string;
  childOrganizationId?: string;
  userId?: string;
  email: string;
  name: string;
  status: MembershipStatus;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrgAuditEvent {
  id: string;
  at: number;
  actorUserId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
}

export interface Booking {
  id: string;
  reference: string;
  roomId: string;
  roomName: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  startTime: number;
  endTime: number;
  people: number;
  title: string;
  notes: string;
  status: string;
  totalPrice: number | null;
  currency: string;
  paymentRequired: boolean;
  confirmationUrl?: string;
  cancellationAllowed?: boolean;
  cancellationMessage?: string;
  editRequested?: boolean;
  /** Demo terms acceptance (version string). */
  termsVersion?: string;
  termsAcceptedAt?: number;
  cancelDeadlineDays?: number;
}
export interface Block {
  id: string;
  roomId: string;
  title: string;
  startTime: number;
  endTime: number;
}
export interface Quote {
  total: number | null;
  currency: string;
  requiresApproval: boolean;
  priceOnRequest: boolean;
  paymentMode: "none" | "invoice" | "hosted";
  token: string;
  message?: string;
}
export interface Config {
  floorplanAvailable: boolean;
  mode: "demo" | "live";
  buildingName: string;
  address: string;
  contactEmail: string;
  access: "public" | "members";
  dashboardUrl: string;
  /** True when Digilist Convex + HTTP URLs are set so email/SMS OTP can call Digilist. */
  digilistAuthConfigured: boolean;
}
export interface BookingInput extends Search {
  roomId: string;
  title: string;
  notes: string;
  quoteToken: string;
  name: string;
  email: string;
  phone?: string;
  /** Must be true; server stores its own terms version. */
  acceptedTerms: boolean;
  /** Organisation represented for this booking (server-validated). */
  organizationId?: string;
}
export interface AdminData {
  bookings: Booking[];
  blocks: Block[];
  rooms: Room[];
  truncated: boolean;
}
export type AccessRequestStatus = "pending" | "approved" | "rejected";
export interface TenantMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "invited";
  /** Møterom portal role managed on Brukere. */
  portalRole?: "member" | "operations" | "full";
  /** Explicit Møterom portal grant (or ADMIN_EMAILS / demo). */
  portalGranted?: boolean;
}
export interface AccessRequest {
  id: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  email: string;
  company: string;
  userId?: string;
  status: AccessRequestStatus;
}
export const RESERVATION_STATUSES = [
  "confirmed",
  "approved",
  "completed",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export type InsightsCoverage = "complete" | "truncated";
export type InsightsPeriodPreset = "7d" | "30d" | "90d" | "custom";
export interface InsightsBooking {
  id: string;
  roomId: string;
  startTime: number;
  endTime: number;
  status: string;
  /** Used only to match an access-request company. Stripped before aggregation. */
  email?: string;
  company?: string;
}
export interface InsightsCompanyRoom {
  roomId: string;
  bookingCount: number;
  reservedHours: number;
}
export interface InsightsCompanyRow {
  company: string;
  bookingCount: number;
  reservedHours: number;
  rooms: InsightsCompanyRoom[];
}
export interface InsightsBlock {
  id: string;
  roomId: string;
  title: string;
  startTime: number;
  endTime: number;
}
export interface InsightsPeriod {
  from: string;
  to: string;
  fromMs: number;
  toMs: number;
}
export interface InsightsRoomRow {
  roomId: string;
  name: string;
  capacity: number;
  capacityLabel: string;
  capacityLabelEn: string;
  amenities: string[];
  image?: string;
  bookingCount: number;
  reservedHours: number;
  averageDurationHours: number | null;
  previousBookingCount?: number;
  previousReservedHours?: number;
}
export interface InsightsTrendPoint {
  date: string;
  from: string;
  toInclusive: string;
  label: string;
  reservedHours: number;
  bookingCount: number;
  incomplete: boolean;
  previousReservedHours?: number;
  previousBookingCount?: number;
}
export interface InsightsBucket {
  weekday: string;
  hour: string;
  reservedHours: number;
}
export interface InsightsRecord {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
}
export interface InsightsEnvelope {
  mode: "demo" | "live";
  coverage: InsightsCoverage;
  timezone: "Europe/Oslo";
  period: InsightsPeriod;
  comparePeriod?: InsightsPeriod;
  includedStatuses: string[];
  generatedAt: number;
  definitions: { id: string; label: string }[];
  rooms: InsightsRoomRow[];
  companies: InsightsCompanyRow[];
  trend: InsightsTrendPoint[];
  trendGrain: "week" | "month";
  totals: { bookingCount: number; reservedHours: number };
  compareTotals?: { bookingCount: number; reservedHours: number };
}
export interface InsightsRoomReport extends InsightsEnvelope {
  room: InsightsRoomRow;
  busiest: InsightsBucket[];
  upcoming: InsightsRecord[];
  upcomingBlocks: InsightsBlock[];
  limitations: string[];
}
export type ConversationKind = "booking" | "support";
export interface ConversationContext {
  roomId: string;
  roomName: string;
  image?: string;
  imageKind?: "illustrative" | "actual";
  capacity?: number;
  capacityLabel?: string;
  capacityLabelEn?: string;
  bookingId: string;
  reference?: string;
  startTime?: number;
  endTime?: number;
  status?: string;
}
export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  bookingId?: string;
  roomId?: string;
  roomName: string;
  subject: string;
  preview: string;
  updatedAt: number;
  unread: number;
  customerName: string;
  customerId?: string;
  context?: ConversationContext;
  /** When true, the composer offers image attach (demo, support, Digilist booking via BFF-hosted files). */
  canAttachImages?: boolean;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  fromAdmin: boolean;
  content: string;
  imageUrl?: string;
  createdAt: number;
  /** Present on thread responses for the viewer's own messages. */
  readByPeer?: boolean;
}
export interface ConversationThread {
  conversation: ConversationSummary | null;
  messages: Message[];
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  createdBy: string;
  active: boolean;
}
