# Møterom

Meeting-room booking for one building. Digilist is the design source and the live booking authority.

## Before editing

Read `README.md`, `CONTRIBUTING.md`, `docs/`, `config/rooms.json`, and the files you will change. Inspect the current branch, `dev`, `main`, and open PRs. Do not rebuild from an empty or outdated branch.

Day-to-day work lands on `dev`. Open a feature PR into `dev`. Release with `dev` → `main`.

## Design

The approved visual direction is Digilist: Inter, navy `#003057`, vendored tokens in `src/design/digilist/`, Digdir form primitives, existing header/sidebar/cards. Put application layout in `src/styles.css`. Do not edit vendored Digilist files. Do not introduce a new design system, palette, font, or navigation concept. Reuse shared components in `src/components/`. Keep customer and admin styling consistent. Product UI supports Norwegian Bokmål (`nb`, default) and English (`en`); room names and customer-entered content stay untranslated.

## Architecture

The browser talks only to the Express BFF. Demo mode uses local SQLite. Live mode uses Digilist REST/Convex. Never mix demo records into live results, never fall back to demo in production, and never mock success for a missing integration.

Server functions enforce identity, tenant membership, ownership, Origin, quotes, and booking rules. Do not trust browser-supplied roles, tenant IDs, prices, or customer IDs.

## Content

Do not invent capacities, equipment, prices, addresses, accessibility claims, or room identities. Eidefossen rooms stay capacity-distinguished until names are confirmed. Illustrative images must be labelled **Illustrasjonsfoto** and recorded in `docs/room-images.md`. Do not commit the private floor plan; use `FLOORPLAN_PATH`.

Paid Digilist checkout does not transfer the selected interval or session. Do not claim payment, invoice creation, email, or SSO unless the corresponding service confirmed it. Pending requests are not confirmed bookings. Change requests leave the original reservation in place until approved.

## Checks

```sh
npm run check
npm run format:check
```

Local demo: `npm ci`, copy `.env.example` to `.env`, `npm run dev` (http://localhost:4173). Report evidence honestly. Do not claim browser, staging, or production checks that were not run.

## Skills

| Skill                               | Use when                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `moterom-design-consistency`        | Frontend, styling, layout, or components                                      |
| `moterom-feature-completeness`      | Adding, changing, or repairing an interactive feature                         |
| `moterom-booking-integrity`         | Availability, pricing, booking, cancellation, approval, calendar, or blocking |
| `moterom-imagery-and-content`       | Images, room content, or product copy                                         |
| `moterom-accessibility-and-mobile`  | Navigation, forms, calendars, dialogs, responsive behaviour, or controls      |
| `moterom-verification-and-delivery` | Before finishing a task or opening a pull request                             |
