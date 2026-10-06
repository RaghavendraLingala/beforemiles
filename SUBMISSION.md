# BeforeMiles — Submission

**Live app:** https://beforemiles.app.space
**Source:** DeepSpace cloud repo for `app_01M46SX8S4H1XGF30TX0PXJWM0`, branch `main`
(reviewer access: see "Delivery" below). Details: [README.md](./README.md).

## What I built and why

BeforeMiles — *Your trip, prepared.* — is a collaborative trip-readiness
planner. Travel prep is scattered across maps, weather apps, notes, and group
chats; BeforeMiles is the "before you leave" layer that keeps trip plans,
checklists, and documents together so companions can prepare as a group: a Trip
Readiness Report, a shared checklist with assignments, useful stops, an
itinerary, private trip documents, and a "What am I missing?" review — shared
live, with owner/editor/viewer roles. Reports and reviews are AI-generated and
labelled that way in the app. It deliberately does not do navigation, live
weather, or booking.

## DeepSpace capabilities used

- **Auth** — sign-in; verified identity on every action and file request.
- **Data + permissions** — trip-scoped collections with `read: 'team'`
  (one team per trip); all writes go through role-checked server actions.
- **Realtime** — live checklist, stops, itinerary, documents, and membership
  changes; removing a member re-syncs their queries.
- **Private storage** — per-user file uploads served only to trip members
  through a membership-checked route.
- **AI** — structured readiness reports and reviews through the DeepSpace AI
  proxy (owner-billed, no API keys in the app).
- **Deployment** — `npx deepspace deploy`, release ledger, rollback.

## Main tradeoff

Trust over breadth. AI content is presented strictly as unverified planning
guidance, and I deferred live weather: the available integration couldn't
reliably tell which place it matched (it failed on "City, ST" and small places
and silently picked one of several "Springfield"s), so it could have shown
real-looking weather for the wrong location. Payments were left out as
unnecessary for the core workflow.

Other known limits: trip deletion is sequential and retryable, not atomic; the
SDK's team-access check failed for a user in ~100 trips during testing (test
cleanup avoids it in the suite but doesn't fix it).

## What Claude Code implemented and tested

Starting from the DeepSpace starter scaffold, Claude Code wrote the app's code
phase by phase at my direction: schemas, server actions, permission checks, AI
prompts, private-file routes, UI, the SDK 0.17 → 0.38 upgrade, and retry-safe
deletion. It also ran and
reported:

- type-check and whole-project lint;
- 38 unit tests (score, regeneration, itinerary, dates, templates, prompt text,
  trip deletion with injected failures);
- a 22-test Playwright suite with two test accounts — 20 run by default; the 2
  real-AI tests were run separately when AI code changed (not re-run in the
  final phase);
- direct server calls as viewers and non-members to confirm refusals;
- production smoke runs against the live URL after most deploys, using test
  accounts and test trips (UI-level; the direct server-call checks run locally only);
- screenshot reviews of key pages at desktop and phone widths.

## What I personally verified

Manual check on https://beforemiles.app.space on **October 5, 2026**, signed in
with my own **Google** account. These passed:

- [x] Google sign-in worked.
- [x] My existing trips appeared.
- [x] A checklist change persisted after reloading the page.
- [x] A document downloaded successfully.
- [x] Sign-out worked.

Not yet verified by me (only the items above were checked manually):

- [ ] GitHub sign-in.
- [ ] Reviewed the landing page.
- [ ] Created a trip and generated a Trip Readiness Report; read it for unsafe or overconfident claims.
- [ ] Assigned checklist items to a traveler; added a manual item.
- [ ] Shared a trip with a second real account and saw changes appear live.
- [ ] Confirmed a viewer can't edit, and a removed member loses the trip.
- [ ] Uploaded a real document (e.g. PDF/PNG).
- [ ] Built an itinerary and ran "What am I missing?".
- [ ] Deleted a disposable trip.
- [ ] Confirmed reviewers can access the source code.

## Delivery

- Live URL: https://beforemiles.app.space — deployed application code is commit
  `0531265` (release #15).
- Source snapshot: a ZIP of a later, documentation-only commit (this file's
  verification update). Its application code is identical to `0531265`; it
  contains no Git history, secrets, local data, dependencies, or build output.
- Source: DeepSpace cloud repository (remote `space`, branch `main`). The live
  URL does not expose source code. **Reviewer access is not yet confirmed** —
  the app currently has no collaborators.

---

## Walkthrough (≈5 minutes)

1. **Create a trip** — Trips → New trip. Pick the "Road trip" template, enter a
   route (e.g. San Francisco, CA → Big Sur, CA) and start/return dates.
2. **Report** — Report tab → Generate report (~15–40 s). Note the "AI-generated
   planning suggestions. Check important details before you travel." notice.
3. **Checklist & assignment** — Checklist tab: check an item; add a manual item
   assigned to a traveler by name.
4. **Shared update** — Members tab: share with a second account as viewer. In
   that account's window, the checklist update appears live and editing
   controls are absent.
5. **Itinerary** — Stops tab: save a stop → "Add to itinerary". Itinerary tab:
   add a departure with a time; reorder with the arrows.
6. **Private document** — Documents tab: upload a file; the viewer can download
   it; non-members can't.
7. **What am I missing?** — Help tab → run the review; add a suggestion to the
   checklist and watch the readiness score on Overview.
