import type { Locale } from "./locale";
import { DEFAULT_LOCALE } from "./locale";

const nb: Record<string, string> = {
  invalid_origin: "Ugyldig forespørsel. Last siden på nytt.",
  too_many_attempts: "For mange forsøk. Vent et minutt og prøv igjen.",
  login_required: "Logg inn for å fortsette.",
  building_member_required: "Du må være medlem av bygget for å bestille.",
  admin_required: "Du har ikke administratortilgang.",
  room_not_found: "Rommet ble ikke funnet.",
  floorplan_unavailable: "Plantegning er ikke tilgjengelig.",
  not_found: "Siden finnes ikke.",
  use_demo_login: "Bruk demoinnloggingen.",
  code_unverified: "Koden kunne ikke bekreftes. Prøv igjen.",
  room_not_bookable: "Rommet kan ikke bestilles.",
  email_must_match_session: "E-posten må være den du er innlogget med.",
  quote_expired: "Pristilbudet er utløpt. Kontroller bestillingen på nytt.",
  booking_changed: "Bestillingen er endret. Kontroller valget på nytt.",
  booking_belongs_to_other: "Bestillingen tilhører en annen bruker.",
  quote_terms_changed:
    "Pris eller bestillingsvilkår er endret. Kontroller bestillingen på nytt.",
  complete_in_digilist:
    "Dette rommet kan ikke bestilles med betaling i møteromsportalen. Kontakt administrator.",
  skb_internal_booking_only:
    "Dette rommet kan ikke bestilles med betaling i møteromsportalen. Kontakt administrator.",
  booking_fingerprint_mismatch:
    "Bestillingen ble endret. Kontroller opplysningene på nytt.",
  room_unavailable: "Rommet er ikke ledig.",
  action_forbidden: "Du har ikke tilgang til denne handlingen.",
  booking_not_pending: "Bookingen venter ikke på godkjenning.",
  booking_not_editable: "Denne bookingen kan ikke endres.",
  future_time_required: "Velg et fremtidig tidspunkt.",
  interval_overlaps: "Tidsrommet overlapper en booking eller blokkering.",
  booking_not_found: "Bookingen ble ikke funnet.",
  booking_wrong_building: "Bookingen tilhører ikke dette bygget.",
  booking_service_unreachable:
    "Vi får ikke kontakt med bookingtjenesten. Prøv igjen.",
  booking_confirm_uncertain:
    "Vi fikk ikke bekreftet svaret. Prøv samme bestilling igjen.",
  session_expired: "Økten er utløpt. Logg inn på nytt.",
  booking_stale:
    "Tidspunktet eller bestillingen har endret seg. Kontroller valget ditt.",
  booking_service_failed: "Bookingtjenesten kunne ikke fullføre forespørselen.",
  members_only_access:
    "Denne bookingløsningen er for byggets medlemmer. Kontakt administrator for tilgang.",
  access_request_not_found: "Forespørselen ble ikke funnet.",
  access_request_members_only:
    "Tilgangsforespørsler brukes bare når portalen er begrenset til medlemmer.",
  already_building_member: "Du er allerede medlem av dette bygget.",
  membership_not_active:
    "Aktivt medlemskap må først bekreftes i Digilist. Forespørselen er fortsatt åpen.",
  room_setup_unavailable:
    "Rommet {{name}} er ikke tilgjengelig i byggets oppsett.",
  admin_building_required: "Du har ikke administratortilgang til dette bygget.",
  edit_agreed_price: "Kontakt utleier for å endre en booking med avtalt pris.",
  block_not_found: "Blokkeringen ble ikke funnet.",
  invalid_date_range: "Velg en gyldig fra- og tildato.",
  end_after_start: "Sluttdato må være etter startdato.",
  period_too_long: "Velg en periode på høyst ett år.",
  unknown_room: "Ukjent rom.",
  invalid_period: "Ugyldig periode.",
  image_upload_demo_only: "I live-modus må rombilder publiseres i Digilist.",
  invalid_image_type: "Bruk WebP, JPEG eller PNG.",
  invalid_image_url: "Bruk en HTTPS-adresse til bildet.",
  image_gallery_managed_in_digilist:
    "Rommet har flere bilder. Administrer bildegalleriet i Digilist før du bytter til illustrasjonsbildet.",
  invalid_image_size: "Bildet må være mellom 32 byte og 2 MB.",
  request_failed: "Noe gikk galt. Prøv igjen.",
  validation_failed: "Kontroller feltene og prøv igjen.",
  booking_service_incomplete:
    "Bookingtjenesten kunne ikke fullføre handlingen. Prøv igjen.",
  availability_fetch_failed: "Kunne ikke hente ledigheten. Prøv igjen.",
  room_busy: "Opptatt i det valgte tidsrommet.",
  room_busy_partial: "Opptatt i deler av tidsrommet.",
  room_busy_slot: "Rommet er opptatt i dette tidsrommet.",
  no_rooms_slot: "Ingen ledige rom i dette tidsrommet.",
  slot_not_bookable: "Tidsrommet kan ikke bestilles.",
  time_past: "Tidspunktet har passert.",
  too_many_participants: "For mange deltakere.",
  invalid_datetime: "Velg en gyldig dato og tid.",
  dst_ambiguous:
    "Tidspunktet finnes ikke eller er tvetydig ved overgang til sommer-/vintertid. Velg et annet tidspunkt.",
  end_after_start_same_day: "Sluttid må være etter starttid samme dag.",
  price_on_request: "Pris etter avtale",
  no_payment: "Ingen betaling",
  change_requested_note: "Endring forespurt fra møteromsportalen.",
  capacity_people: "{{count}} personer",
  notes_change_prefix: "Ønsket endring: {{notes}}",
  ics_reference: "Referanse: {{reference}}",
  insights_def_booking_count:
    "Antall reservasjoner som starter i perioden (bekreftet, godkjent eller fullført).",
  insights_def_reserved_hours:
    "Reserverte romtimer i perioden. Intervallene klippes mot periodens grenser i Europe/Oslo.",
  insights_limit_demo:
    "Demodata. Tallene følger de samme reglene som live, men er ikke produksjonsdata.",
  insights_limit_truncated:
    "Listen over bookinger er avkortet. Tallene er et nedre anslag.",
  insights_limit_confirmed_only:
    "Kun bekreftede, godkjente og fullførte reservasjoner inngår.",
  insights_limit_not_attendance:
    "Reserverte timer er ikke oppmøte, og ledighet nå er ikke det samme som bookbarhet.",
  insights_limit_no_opening_hours:
    "Utnyttelse mot åpningstid vises ikke fordi historiske åpningstider ikke er tilgjengelige.",
  insights_limit_timezone: "Alle perioder er beregnet i Europe/Oslo.",
  insights_week_from: "Uke fra {{date}}",
  insights_week_number: "Uke {{week}}",
  insights_unchanged: "uendret",
  insights_from_zero: "fra 0 til {{value}}",
  weekday_mon: "man",
  weekday_tue: "tir",
  weekday_wed: "ons",
  weekday_thu: "tor",
  weekday_fri: "fre",
  weekday_sat: "lør",
  weekday_sun: "søn",
};

const en: Record<string, string> = {
  invalid_origin: "Invalid request. Reload the page.",
  too_many_attempts: "Too many attempts. Wait a minute and try again.",
  login_required: "Sign in to continue.",
  building_member_required: "You must be a member of the building to book.",
  admin_required: "You do not have administrator access.",
  room_not_found: "The room was not found.",
  floorplan_unavailable: "Floor plan is not available.",
  not_found: "Page not found.",
  use_demo_login: "Use the demo sign-in.",
  code_unverified: "The code could not be verified. Try again.",
  room_not_bookable: "The room cannot be booked.",
  email_must_match_session:
    "The email must match the one you are signed in with.",
  quote_expired: "The quote has expired. Review the booking again.",
  booking_changed: "The booking has changed. Review your selection again.",
  booking_belongs_to_other: "This booking belongs to another user.",
  quote_terms_changed:
    "Price or booking terms have changed. Review the booking again.",
  complete_in_digilist:
    "This room cannot be booked with payment in the meeting-room portal. Contact an administrator.",
  skb_internal_booking_only:
    "This room cannot be booked with payment in the meeting-room portal. Contact an administrator.",
  booking_fingerprint_mismatch:
    "The booking was changed. Review the details again.",
  room_unavailable: "The room is not available.",
  action_forbidden: "You do not have access to this action.",
  booking_not_pending: "The booking is not awaiting approval.",
  booking_not_editable: "This booking cannot be changed.",
  future_time_required: "Choose a future time.",
  interval_overlaps: "The time slot overlaps a booking or block.",
  booking_not_found: "The booking was not found.",
  booking_wrong_building: "The booking does not belong to this building.",
  booking_service_unreachable:
    "We cannot reach the booking service. Try again.",
  booking_confirm_uncertain:
    "We could not confirm the response. Try the same booking again.",
  session_expired: "Your session has expired. Sign in again.",
  booking_stale: "The time or booking has changed. Review your selection.",
  booking_service_failed: "The booking service could not complete the request.",
  members_only_access:
    "This booking solution is for building members. Contact an administrator for access.",
  access_request_not_found: "The access request was not found.",
  access_request_members_only:
    "Access requests are only used when the portal is limited to members.",
  already_building_member: "You are already a member of this building.",
  membership_not_active:
    "Active membership must first be confirmed in Digilist. The request remains open.",
  room_setup_unavailable:
    "Room {{name}} is not available in the building setup.",
  admin_building_required:
    "You do not have administrator access to this building.",
  edit_agreed_price:
    "Contact the host to change a booking with an agreed price.",
  block_not_found: "The block was not found.",
  invalid_date_range: "Choose a valid from and to date.",
  end_after_start: "End date must be after start date.",
  period_too_long: "Choose a period of at most one year.",
  unknown_room: "Unknown room.",
  invalid_period: "Invalid period.",
  image_upload_demo_only:
    "In live mode, room photos must be published in Digilist.",
  invalid_image_type: "Use WebP, JPEG or PNG.",
  invalid_image_url: "Use an HTTPS photo URL.",
  image_gallery_managed_in_digilist:
    "This room has multiple photos. Manage its gallery in Digilist before switching to the catalogue illustration.",
  invalid_image_size: "The image must be between 32 bytes and 2 MB.",
  request_failed: "Something went wrong. Try again.",
  validation_failed: "Check the fields and try again.",
  booking_service_incomplete:
    "The booking service could not complete the action. Try again.",
  availability_fetch_failed: "Could not fetch availability. Try again.",
  room_busy: "Busy in the selected time slot.",
  room_busy_partial: "Busy for part of the time slot.",
  room_busy_slot: "The room is busy in this time slot.",
  no_rooms_slot: "No rooms are available in this time slot.",
  slot_not_bookable: "This time slot cannot be booked.",
  time_past: "The time has already passed.",
  too_many_participants: "Too many participants.",
  invalid_datetime: "Choose a valid date and time.",
  dst_ambiguous:
    "That time does not exist or is ambiguous at the daylight-saving transition. Choose another time.",
  end_after_start_same_day:
    "End time must be after start time on the same day.",
  price_on_request: "Price on request",
  no_payment: "No payment",
  change_requested_note: "Change requested from the meeting-room portal.",
  capacity_people: "{{count}} people",
  notes_change_prefix: "Requested change: {{notes}}",
  ics_reference: "Reference: {{reference}}",
  insights_def_booking_count:
    "Number of reservations that start in the period (confirmed, approved or completed).",
  insights_def_reserved_hours:
    "Reserved room-hours in the period. Intervals are clipped to the period bounds in Europe/Oslo.",
  insights_limit_demo:
    "Demo data. Figures follow the same rules as live, but are not production data.",
  insights_limit_truncated:
    "The booking list is truncated. Figures are a lower bound.",
  insights_limit_confirmed_only:
    "Only confirmed, approved and completed reservations are included.",
  insights_limit_not_attendance:
    "Reserved hours are not attendance, and current free/busy is not the same as bookability.",
  insights_limit_no_opening_hours:
    "Utilisation against opening hours is not shown because historical opening hours are unavailable.",
  insights_limit_timezone: "All periods are calculated in Europe/Oslo.",
  insights_week_from: "Week from {{date}}",
  insights_week_number: "Week {{week}}",
  insights_unchanged: "unchanged",
  insights_from_zero: "from 0 to {{value}}",
  weekday_mon: "Mon",
  weekday_tue: "Tue",
  weekday_wed: "Wed",
  weekday_thu: "Thu",
  weekday_fri: "Fri",
  weekday_sat: "Sat",
  weekday_sun: "Sun",
};

const catalogs: Record<Locale, Record<string, string>> = { nb, en };

export function translateMessage(
  locale: Locale,
  code: string,
  params?: Record<string, string | number>,
  fallback?: string,
): string {
  const catalog = catalogs[locale] || catalogs[DEFAULT_LOCALE];
  let template =
    catalog[code] ||
    catalogs[DEFAULT_LOCALE][code] ||
    fallback ||
    catalogs[DEFAULT_LOCALE].request_failed ||
    code;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      template = template.replaceAll(`{{${key}}}`, String(value));
    }
  }
  return template;
}

export function capacityPeopleLabel(locale: Locale, count: number) {
  return translateMessage(locale, "capacity_people", { count });
}
