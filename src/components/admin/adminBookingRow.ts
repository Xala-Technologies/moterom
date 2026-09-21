import type { Booking, Room } from "../../../shared/types";

export type AdminTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type AdminFormatters = {
  displayDate: (ms: number, weekday?: boolean) => string;
  shortTime: (ms: number) => string;
  money: (amount: number, currency: string) => string;
};

export type AdminBookingActionId = "approve" | "reject";

export type AdminBookingAction = {
  id: AdminBookingActionId;
  label: string;
  disabled?: boolean;
  tone?: "success" | "danger" | "default";
};

export type AdminPaymentTone = "none" | "unpaid" | "default";

export type AdminStatusTone =
  "neutral" | "warning" | "success" | "info" | "danger";

export type AdminBookingRow = {
  id: string;
  reference: string;
  roomId: string;
  roomName: string;
  imageUrl: string | null;
  imageKind: "actual" | "illustrative" | "unknown";
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  statusLabel: string;
  statusTone: AdminStatusTone;
  cancelled: boolean;
  dateSpanLabel: string;
  timeWithDurationLabel: string;
  paymentAmountLabel: string;
  paymentStatusLabel: string | null;
  paymentTone: AdminPaymentTone;
  openAriaLabel: string;
  editRequestedLabel: string | null;
  actions: AdminBookingAction[];
};

export type AdminBookingListColumns = {
  resource: string;
  schedule: string;
  customer: string;
  payment: string;
  status: string;
  actions: string;
};

function statusTone(status: string): AdminStatusTone {
  switch (status) {
    case "pending":
      return "warning";
    case "confirmed":
      return "success";
    case "completed":
      return "info";
    case "rejected":
      return "danger";
    case "cancelled":
    default:
      return "neutral";
  }
}

function statusLabel(status: string, t: AdminTranslate): string {
  const key = `common.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

/**
 * Build a Digilist-inspired admin row from a Møterom booking.
 * Payment stays unknown unless the server marks payment as required.
 */
export function toAdminBookingRow(
  booking: Booking,
  opts: {
    t: AdminTranslate;
    formatters: AdminFormatters;
    room?: Room;
    canApprove?: boolean;
    canReject?: boolean;
    busy?: boolean;
  },
): AdminBookingRow {
  const { t, formatters, room, canApprove, canReject, busy } = opts;
  const actions: AdminBookingAction[] = [];
  if (canApprove && booking.status === "pending") {
    actions.push({
      id: "approve",
      label: t("admin.approve"),
      disabled: busy,
      tone: "success",
    });
  }
  if (canReject && booking.status === "pending") {
    actions.push({
      id: "reject",
      label: t("admin.reject"),
      disabled: busy,
      tone: "danger",
    });
  }

  let paymentTone: AdminPaymentTone = "none";
  let paymentStatusLabel: string | null = null;
  if (booking.paymentRequired) {
    paymentTone = "unpaid";
    paymentStatusLabel = t("booking.payment_outstanding");
  }

  const amountLabel =
    typeof booking.totalPrice === "number" && booking.totalPrice > 0
      ? formatters.money(booking.totalPrice, booking.currency)
      : t("common.money.no_payment");

  const imageKind =
    room?.imageKind === "actual"
      ? "actual"
      : room?.image
        ? "illustrative"
        : "unknown";

  return {
    id: booking.id,
    reference: booking.reference,
    roomId: booking.roomId,
    roomName: booking.roomName,
    imageUrl: room?.image ?? null,
    imageKind,
    customerName: booking.name || booking.email || booking.reference,
    customerEmail: booking.email || null,
    customerPhone: booking.phone || null,
    status: booking.status,
    statusLabel: statusLabel(booking.status, t),
    statusTone: statusTone(booking.status),
    cancelled: booking.status === "cancelled",
    dateSpanLabel: formatters.displayDate(booking.startTime, true),
    timeWithDurationLabel: `${formatters.shortTime(booking.startTime)}–${formatters.shortTime(booking.endTime)}`,
    paymentAmountLabel: amountLabel,
    paymentStatusLabel,
    paymentTone,
    openAriaLabel: t("admin.open_booking_aria", {
      room: booking.roomName,
      reference: booking.reference,
    }),
    editRequestedLabel: booking.editRequested
      ? t("admin.edit_requested")
      : null,
    actions,
  };
}

export function adminBookingListColumns(
  t: AdminTranslate,
): AdminBookingListColumns {
  return {
    resource: t("admin.cols.resource"),
    schedule: t("admin.cols.schedule"),
    customer: t("admin.cols.customer"),
    payment: t("admin.cols.payment"),
    status: t("admin.cols.status"),
    actions: t("admin.cols.actions"),
  };
}
