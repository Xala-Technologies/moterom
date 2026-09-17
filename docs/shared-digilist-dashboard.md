# Shared Digilist dashboard for Møterom

Status: proposed migration contract. No application or Digilist source changes have been made.

Reviewed on 17 September 2026:

- Møterom `dev` and `main`: `9992697ac8293d28d2586e61bafa5324a71e8380`.
- Digilist `dev`: `ff08dc9a1de74462533fc92a7f67e69f9be662e2`.

## Outcome

Møterom keeps its public booking journey, own admin navigation, English and Norwegian support, and Express backend. Its booking list and calendar consume versioned presentation modules maintained in Digilist.

Digilist remains the live booking authority. The shared UI does not introduce another database, identity provider, booking engine, or browser connection to Convex.

## Verified starting point

| Area                  | Current source                                               | Consequence                                                                                                             |
| --------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Møterom admin         | `src/pages/Admin.tsx`                                        | Contains navigation, booking list, calendar, dialogs and action orchestration. Extract screen composition gradually.    |
| Møterom reports       | `src/pages/AdminInsights.tsx`, `server/insights.ts`          | Already present. Retain their scoped reporting and completeness behavior.                                               |
| Møterom languages     | `src/i18n/index.tsx`, `src/i18n/locales/{nb,en}.json`        | Already present. Preserve saved language choice and translated interface.                                               |
| Møterom backend       | `server/app.ts`, `server/digilist.ts`                        | Same-origin Express backend owns verified sessions, tenant scope and provider calls. Keep this boundary.                |
| Digilist booking list | `apps/dashboard/src/routes/bookings/list/`                   | Presentation components exist, but depend on local view models, translations, routing and shared packages.              |
| Digilist calendar     | `packages/digilist/src/calendar/`                            | Calendar components already exist in a shared workspace package. Presentation and connected hooks share an entry point. |
| Digilist distribution | `packages/ds/package.json`, `packages/digilist/package.json` | Private, source-only workspace packages. External installation is not established by their current manifests.           |

The inspected Digilist `TimelineView` hardcodes Norwegian labels, uses browser-local dates, and buckets events by their start day. A direct import would not preserve Møterom's English support, Oslo calendar boundaries, or cross-midnight overlap behavior. These are extraction prerequisites, not reasons to weaken Møterom's behavior.

Møterom's configured live room slugs are currently empty. Source work and demo tests can proceed without them. Live acceptance requires the real building configuration.

## Architecture decision

Create a proposed `@digilist/room-admin` package in Digilist for portable presentation. Both applications should consume the same views.

Keep application-specific wrappers:

- Digilist wrapper: existing SDK hooks, app-shell identity, permissions, routing and translations.
- Møterom wrapper: existing Express endpoints, verified session, normalized room/booking records, routing and translations.

The shared package receives typed display models, translated labels, formatting functions and callbacks. It does not fetch records, infer permissions, switch tenants or initiate writes.

The package source may reuse `@digilist/ds` internally. Its published output must bundle the required presentation dependencies or declare independently installable dependencies. It must not ship unresolved `workspace:*` references, monorepo-relative paths, Convex generated imports, or an application-shell dependency.

React and React DOM remain peer dependencies. Export required component CSS explicitly. Keep host theme tokens and avoid global style resets.

Use a scoped private registry for versioned releases. Registry credentials belong in the build environment, never client configuration. Validate the packed artifact in an isolated consumer before publishing. Publishing and release rollout are separate from the feature PRs.

Do not substitute a hand-edited copy of the dashboard or pretend an alias is the original design-system package.

## Presentation contracts

### Booking list

Define a transport-independent row model containing:

- Stable record ID and reference.
- Room ID, name, image and image provenance.
- Customer display name and authorized contact details.
- Scheduled interval, display labels and booking status.
- Optional, explicitly defined price/payment presentation.
- Supported action descriptors with pending/disabled state.
- Detail destination or callback supplied by the host application.

Use status labels separately from stable backend status values. Missing payment information stays unknown. A positive booking price alone must not produce a paid badge.

The shared view renders columns, responsive rows, images, status and action placement. Hosts own search, pagination, filters, state, confirmation dialogs and writes.

Callbacks resolve the authoritative record by stable ID. Optional actions appear only when the host supports them. The server remains responsible for authorization and current-state validation.

Preserve keyboard interaction with nested links and buttons. Activating an action must not also open the row. Use matching column definitions for headers and rows.

### Calendar

Define a view contract containing:

- Room display models.
- Booking and block intervals with stable IDs, kind and status.
- Selected local date, supported view and explicit time zone.
- Locale/formatting and translated labels.
- Loading, error and completeness state.
- Selection and navigation callbacks.

Use epoch timestamps for actual instants and an explicit IANA time zone for calendar boundaries. Do not convert instants into fabricated browser-local dates.

Clip and split intervals for display when they overlap a day boundary. Keep selection linked to the original booking or block. Distinguish confirmed reservations, pending requests and operational blocks.

Retain Møterom's room-by-room day view, seven-day view and mobile agenda. Verify equivalent behavior before replacing any view. Unsupported drag-to-create, reschedule, or resize controls remain outside the shared contract until the host supplies real authorized actions.

## File-level work

| Repository | Proposed change                                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digilist   | Add `packages/room-admin/` with public contracts, portable views, CSS exports, package build and focused tests.                                                                                       |
| Digilist   | Extract presentation from `BookingListItem.tsx`, `BookingListItemActions.tsx` and `BookingListStatusBadge.tsx`. Keep existing view-model construction and SDK orchestration in the dashboard wrapper. |
| Digilist   | Separate calendar presentation from connected hooks. Correct locale, explicit timezone and overlapping-day handling before adoption.                                                                  |
| Digilist   | Update existing dashboard callers to use the extracted views. Preserve exports or wrappers where other callers depend on them.                                                                        |
| Digilist   | Add a release/build contract and isolated package-consumer check. Review package contents for accidental private application code.                                                                    |
| Møterom    | Add `src/components/admin/` wrappers and pure booking/calendar display-model adapters.                                                                                                                |
| Møterom    | Replace the corresponding list/calendar composition in `src/pages/Admin.tsx`. Retain its verified API actions and existing dialogs.                                                                   |
| Møterom    | Add the released package dependency and lockfile. Keep CSS changes within the established application styling policy.                                                                                 |
| Møterom    | Add focused adapter tests and update source provenance and acceptance records.                                                                                                                        |

Paths for the new package and wrappers are proposals. Confirm naming against existing package and registry conventions before creating them.

## Delivery sequence

1. Run Digilist's required impact analysis on the components and all existing callers. Record affected flows before extraction.
2. Define the presentation contracts and create an installable package skeleton. Prove its packed output works outside the monorepo.
3. Extract the booking list and make Digilist use it. Verify existing booking actions, loading states and navigation.
4. Publish an approved prerelease and adopt it in Møterom behind a reversible local composition change.
5. Extract and correct calendar presentation. Verify timezone, language, overlap and accessibility behavior in both applications.
6. Adopt the calendar in Møterom. Retain overview, room editing, settings and insights behavior.
7. Complete package and application checks, then open coordinated feature PRs into each repository's `dev`.
8. Review and release through each repository's existing process. Do not merge or deploy as part of extraction work.

Do not replace the whole admin screen in one commit. Each replacement must have a working host adapter and a tested package version.

## Verification contract

- Both applications render the same package version's booking rows and calendar views.
- Search, status filters, pagination and empty/error states remain functional.
- Approve/reject and block actions preserve their existing endpoint, identity, authorization, duplicate-submission handling and refresh behavior.
- Unauthorized users and out-of-building room IDs are rejected server-side.
- Pending requests remain distinct from confirmed reservations.
- Events crossing midnight and reporting boundaries remain visible on every overlapping day.
- Oslo daylight-saving transitions work when the browser is configured to UTC, Oslo and a different time zone.
- Norwegian and English work after navigation and reload, including all shared labels and accessible names.
- Keyboard actions, focus return, mobile agenda, 200% zoom and both themes remain usable.
- Incomplete or capped booking lists retain their completeness message.
- The package includes no demo records, runtime credentials, Convex client setup or duplicate React installation.
- `npm run check` and `npm run format:check` pass in Møterom.
- Digilist's required impact, change-scope and verification gates pass for its feature branch.

Use demo or dedicated staging records for write checks. Record browser checks separately from source review and unit tests.

## Current execution blocker

Digilist's `AGENTS.md` and GitNexus refactoring skill require `impact` before extracting existing symbols and `detect_changes` before committing. This session has neither the GitNexus MCP tools nor an installed GitNexus CLI.

The GitHub connector can read private Digilist source. A direct Git clone could not authenticate, so a complete local checkout and index could not be prepared through the available Git transport.

No Digilist source has been changed. No application source has been changed. This document is the reviewable output of the dependency investigation.

Resume the feature work in an authorized workspace with both repositories checked out and GitNexus available. Recheck branch heads, open PRs and repository instructions there before beginning. The reviewed commits above are evidence for this plan, not an instruction to overwrite newer work.
