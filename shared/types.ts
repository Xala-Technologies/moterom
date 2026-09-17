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
  nameNeedsConfirmation?: boolean;
  arrivalInfo?: string;
  sourceId?: string;
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
  /** True when Digilist Convex + HTTP URLs are set so email/SMS/BankID can call Digilist. */
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
}
export interface AdminData {
  bookings: Booking[];
  blocks: Block[];
  rooms: Room[];
  truncated: boolean;
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
