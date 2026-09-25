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

export type AdminBookingActionId =
  "approve" | "reject" | "cancel" | "message" | "calendar";

export type AdminBookingAction = {
  id: AdminBookingActionId;
  label: string;
  disabled?: boolean;
  tone?: "success" | "danger" | "default";
  /** Primary row buttons; overflow menu when false. */
  primary?: boolean;
  href?: string;
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
  actionsMenuAriaLabel: string;
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

/** Same active rule as customer booking detail: open status and not ended. */
export function bookingIsCancellable(
  booking: Pick<Booking, "status" | "endTime" | "cancellationAllowed">,
  now = Date.now(),
): boolean {
  if (booking.cancellationAllowed === false) return false;
  if (["cancelled", "rejected", "completed"].includes(booking.status))
    return false;
  return booking.endTime > now;
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
    canCancel?: boolean;
    canMessage?: boolean;
    canCalendar?: boolean;
    busy?: boolean;
  },
): AdminBookingRow {
  const {
    t,
    formatters,
    room,
    canApprove,
    canReject,
    canCancel,
    canMessage,
    canCalendar,
    busy,
  } = opts;
  const actions: AdminBookingAction[] = [];
  if (canApprove && booking.status === "pending") {
    actions.push({
      id: "approve",
      label: t("admin.approve"),
      disabled: busy,
      tone: "success",
      primary: true,
    });
  }
  if (canReject && booking.status === "pending") {
    actions.push({
      id: "reject",
      label: t("admin.reject"),
      disabled: busy,
      tone: "danger",
      primary: true,
    });
  }
  if (canMessage) {
    actions.push({
      id: "message",
      label: t("admin.follow_up"),
      disabled: busy,
      tone: "default",
      href: `/booking/${encodeURIComponent(booking.id)}#meldinger`,
    });
  }
  if (canCalendar && !["cancelled", "rejected"].includes(booking.status)) {
    actions.push({
      id: "calendar",
      label: t("booking.add_to_calendar"),
      disabled: busy,
      tone: "default",
      href: `/api/bookings/${encodeURIComponent(booking.id)}/calendar.ics`,
    });
  }
  if (canCancel && bookingIsCancellable(booking)) {
    actions.push({
      id: "cancel",
      label: t("admin.cancel_booking"),
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
    actionsMenuAriaLabel: t("admin.booking_actions_menu", {
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
