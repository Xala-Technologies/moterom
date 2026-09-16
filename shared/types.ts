export interface Room {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  capacityLabel: string;
  description: string;
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
}
export interface BookingInput extends Search {
  roomId: string;
  title: string;
  notes: string;
  quoteToken: string;
}
export interface AdminData {
  bookings: Booking[];
  blocks: Block[];
  rooms: Room[];
  truncated: boolean;
}
