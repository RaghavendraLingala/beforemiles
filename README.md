# BeforeMiles

**Your trip, prepared.** BeforeMiles is a collaborative trip-readiness planner:
keep your trip plans, checklists, and documents together, and prepare with your
travel companions. You enter a route, dates, and how you're traveling; together
you work through a Trip Readiness Report (AI-generated), a shared checklist with
assignments, useful stops, an itinerary, private trip documents, and a "What am
I missing?" review of the plan.


It is a readiness layer, not a navigation app: no maps, live traffic, or live
weather.

**Intended users:** road-trippers, families, solo travelers, students heading
somewhere unfamiliar, and hikers — anyone preparing a trip, alone or with
others.

**Live app:** https://beforemiles.app.space
(The live URL serves the app only; it does not provide access to source code —
see [Source code](#source-code).)

---

## Features (as deployed)

| Area | What it does |
|---|---|
| Sign-in & private trips | Users sign in and see only trips they own or were added to. |
| Trips | Create a trip: route, optional stops, start date and optional return date, trip type, travel mode, travelers, preferences. Six client-side templates (road, hiking, family, city, business, airport) prefill trip style. |
| Trip Readiness Report | AI-generated, structured prep guidance: summary, weather-aware preparation (typical conditions to check, never a forecast), what to carry, clothing, emergency preparedness, safety notes. Labelled as unverified planning guidance. |
| Checklist | AI-suggested items plus manual items, grouped by category; check/uncheck with "checked by" attribution; free-text assignment to a traveler; filter by AI vs manual. |
| Useful stops | AI-suggested stop types; save/unsave; saved stops can be added to the itinerary. |
| Readiness score | 80 points for checklist completion + 20 points for saved stops (full at 3). It measures preparation progress only — **not** how safe a trip is. |
| Itinerary | Ordered timeline with type, optional date/time, location, notes; move up/down, edit, remove. |
| Documents | Upload files (≤ 10 MB) to the trip; stored privately and downloadable only by trip members. |
| What am I missing? | AI review of the trip's current state (report, checklist progress, stops, documents, score) returning 3–5 prioritized suggestions; each can be added to the checklist. |
| Sharing | Owner shares by email as editor or viewer; changes sync live to everyone on the trip. |
| Deletes | Delete trip (owner), remove member (owner), delete document and manual checklist items (owner/editor), remove itinerary items (owner/editor) — all with confirmation dialogs. |
| Settings | Account and sign-out, trip defaults (travel mode, travelers, preferences), report style (concise / detailed / safety-focused — applies to AI-generated reports and reviews), privacy explainer, list of features not included. |

---

## Architecture

- **Client:** React 19 + Vite, file-based routes (`src/pages`), Tailwind with the
  app's own theme. `/` is a static landing page (no auth request, no realtime
  connection); everything under `src/pages/(app)/` runs inside the DeepSpace
  auth and records providers.
- **Server:** a Hono worker on Cloudflare Workers (`worker.ts`), deployed with
  DeepSpace. A Durable Object `RecordRoom` stores all collections and pushes
  changes to clients over WebSockets.
- **Writes:** the browser never writes trip data directly. Every mutation is a
  server action (`src/actions/index.ts`, `POST /api/actions/:name`) that checks
  the caller's trip role first.
- **Private files:** uploads go to the uploader's private storage scope.
  `GET /api/trip-documents/:id/file` (`src/server/document-routes.ts`) checks
  trip membership, then reads the file as its uploader.
- **AI:** `src/ai/readiness.ts` and `src/ai/readiness-review.ts` make one
  structured-output call each (`claude-sonnet-5`) through the DeepSpace AI proxy;
  no API keys live in the app.

### DeepSpace capabilities used

| Capability | How BeforeMiles uses it |
|---|---|
| Auth | Sign-in; caller identity comes from a verified JWT on every action and file request. |
| Data | Collections (below) in the app's `RecordRoom`, read with `useQuery`. |
| Permissions | Collection RBAC with `read: 'team'` + `team_members` (one "team" per trip); no client writes. Role checks (owner/editor/viewer) in every server action. |
| Realtime | Live queries: checklist ticks, saved stops, itinerary changes, documents, membership changes. Removing a member re-syncs their queries, so the trip disappears for them. |
| Private storage | `useR2Files` in the default per-user scope; server-side membership-checked reads and deletes. |
| AI | DeepSpace AI proxy (owner-billed), structured output via the AI SDK. |
| Deployment | `npx deepspace deploy` to `beforemiles.app.space`, with a release ledger and rollback. |

Not used: payments (not needed for the core workflow), integrations (weather was
investigated and deferred — see [Tradeoffs](#tradeoffs-and-limitations)).

### Collections

`trips`, `team_members`, `reports`, `checklist_items`, `stop_suggestions`,
`itinerary_items`, `trip_documents`, `readiness_reviews`, `user_preferences`
(plus the scaffold's `users` and `settings`). Schemas live in `src/schemas/`.

### Server actions

`createTrip`, `shareTrip`, `generateReport`, `setChecklistItemChecked`,
`addManualChecklistItem`, `updateChecklistItemAssignment`, `setStopSaved`,
`addTripDocument`, `generateReadinessReview`, `addItineraryItem`,
`updateItineraryItem`, `moveItineraryItem`, `removeItineraryItem`,
`saveUserPreferences`, `deleteTrip`, `removeTripMember`, `deleteTripDocument`,
`deleteManualChecklistItem`.

---

## Permission model

| | Owner | Editor | Viewer |
|---|:-:|:-:|:-:|
| Read the trip, report, checklist, stops, itinerary, documents | ✓ | ✓ | ✓ |
| Download documents | ✓ | ✓ | ✓ |
| Generate report / review, check items, add & assign items, save stops, edit itinerary, upload & delete documents, delete manual items | ✓ | ✓ | – |
| Share, change roles, remove members, delete the trip | ✓ | – | – |

- Enforced on the server: each action resolves the caller's membership on the
  record's **own** trip (not a trip id taken from the request). The e2e suite
  calls these actions directly as a viewer and as a non-member to confirm they
  are refused.
- The owner can't be removed. Trips are private until shared.
- You can only share with someone who has signed in to the app at least once.
- `user_preferences` rows are readable only by their owner.

---

## Local setup

Requirements: Node `>=22.15 <23`, `>=24 <25`, or `>=26 <27` (odd majors are not
supported) and npm `>= 11.6`.

```bash
npm install
npx deepspace auth login     # opens a browser sign-in
npx deepspace dev start      # local dev server (Vite + local Workers runtime)
```

Notes:
- The app id in `wrangler.toml` is registered to the owner's DeepSpace account;
  running `dev`, `test`, or `deploy` requires being the owner or an app
  collaborator.
- File uploads in local dev need the app to have been deployed at least once
  (the platform identity token is provisioned on deploy).
- AI reports/reviews in local dev make real, owner-billed model calls.

### Configuration

No app secrets are set (`npx deepspace secrets list` reports none). DeepSpace writes
`.dev.vars` on every dev/test run — do not edit or commit it. Names only:

| Name | Where | Purpose |
|---|---|---|
| `DEEPSPACE_APP_ID`, `APP_NAME` | `wrangler.toml` `[vars]` | App identity and subdomain label |
| `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_ISSUER`, `AUTH_WORKER_URL` | `.dev.vars` / platform | JWT verification and auth proxy |
| `API_WORKER_URL`, `PLATFORM_WORKER_URL` | `.dev.vars` / platform | AI proxy, integrations, file storage |
| `OWNER_USER_ID`, `APP_OWNER_JWT` | `.dev.vars` / platform | Owner identity; owner-billed AI calls |
| `APP_IDENTITY_TOKEN` | `.dev.vars` / platform | App identity for private file access |
| `ALLOW_DEBUG_ROUTES` | `.dev.vars` | Local-only debug routes |
| `RUN_AI_TESTS` | shell (tests only) | `1` enables the two real-AI e2e tests |
| `DEEPSPACE_PORT` | shell (tests only) | Test server port (default 5173) |

---

## Testing

```bash
npm run type-check                      # tsc --noEmit
npm run lint                            # eslint . (whole project, including tests/)
npm run test:unit                       # vitest: 38 unit tests in src/**/*.test.ts
npx deepspace test run e2e --port 5191  # Playwright: smoke, api, collab, trips
RUN_AI_TESTS=1 npx deepspace test run e2e --port 5191   # + 2 real, owner-billed AI tests
```

- Lint the **whole project** (`npm run lint`), not just `src/`: the dev server's
  checker runs `eslint .`, and a lint error anywhere puts an overlay over the
  page that blocks e2e clicks.
- e2e suite: 22 tests (20 run by default, 2 skipped unless `RUN_AI_TESTS=1`).
  They use two DeepSpace test accounts named **"RouteReady A"** and
  **"RouteReady B"** — test identities kept from before the rename (`npx deepspace test accounts create --email … --name …`);
  `tests/trips.spec.ts` contains RouteReady B's email for sharing.
- Some e2e tests call server actions directly from the browser by importing
  `src/lib/actions.ts` through the Vite dev server. Those checks only run
  locally, not against the deployed site.
- The `trips.spec.ts` fixture deletes every trip each test created
  (tracked from that test's own `createTrip` responses).
- Unit tests cover the readiness score, regeneration rules, itinerary rules,
  date handling, templates, prompt-state text, and trip deletion with injected
  failures (`src/server/trip-deletion.test.ts`).

---

## Trip deletion behavior

`deleteTrip` (owner only) runs sequential, idempotent steps — it is **retryable,
not atomic** (`src/server/trip-deletion.ts`):

1. Check the caller is the trip owner — on every call, including retries.
2. For each document: delete the private file, then its metadata row. A file
   that's already missing counts as deleted. If a file can't be deleted, its
   metadata row is kept (it holds the key and uploader needed to retry) and the
   action stops with an error.
3. Delete checklist items, stop suggestions, itinerary items, the report, and
   the review.
4. Delete the trip record (skipped if a previous attempt already removed it).
5. Remove other members' memberships, then the owner's membership last.

If a step fails, **earlier steps may already have succeeded** — for example,
some documents (file and metadata) may already be gone when a later file fails.
Calling `deleteTrip` again resumes where it stopped, and authorization is never
skipped because a record is missing.

**Final-membership case:** if only the last step fails, everything is deleted
except the owner's own membership row. That row grants access to nothing, but
the trip page no longer exists in the UI, so the "Delete trip" button can't be
used to retry. Finishing requires calling the server action again as the owner,
e.g. an authenticated `POST /api/actions/deleteTrip` with `{ "tripId": "…" }`.
Until then, the row counts toward the per-user team-access limit below.

`deleteTripDocument` deletes the file, then its metadata; if the file can't be
deleted, the metadata is kept and the user can retry.

---

## Tradeoffs and limitations

- **AI output is unverified planning guidance.** Reports and reviews use the
  model's general knowledge — no live weather, traffic, closures, or verified
  places — and say so in the UI. They are owner-billed; generation is limited
  to owners/editors with a 60-second cooldown per trip, but there is no daily cap.
  The "Report style" setting adds one prompt instruction; it doesn't guarantee a tone.
  Generated reports and reviews carry the notice "AI-generated planning
  suggestions. Check important details before you travel."
- **Readiness score** measures checklist and saved-stop progress only. Its
  weights (80/20, full points at 3 stops) are a product choice.
- **Team-access scaling limit.** The SDK's `read: 'team'` check passes each of a
  user's trip ids as a separate SQL parameter; in local testing, a user in about
  100 trips hit `too many SQL variables` and their trip queries failed. The e2e
  fixture's cleanup prevents test data from accumulating, but it **does not fix
  this limit** — a real user in ~100+ trips would hit it.
- **Weather — investigated, deferred.** The available integration
  (`openweathermap`) takes text locations only, covers 5 days, doesn't report
  which place it matched, has no precipitation or wind in its forecast, and
  bills failed calls. In testing it failed for "San Francisco, CA" (needs
  `San Francisco,CA,US`) and for small places like Big Sur, and resolved an
  ambiguous "Springfield" without saying which one. That risked showing
  real-looking weather for the wrong place.
- **Payments** — not needed for the core workflow.
- **Not included:** maps, editing a trip after creation, email invitations
  (people must sign in once before being added), export/share links, bulk
  delete, undo, account deletion, deleting individual AI checklist items.
- **Sharing:** email match is exact (lowercased); viewers can upload to their
  own private storage even though they can't attach files to a trip.
- **Documents:** the 10 MB limit is checked against the size the client reports;
  files stay readable to members after their uploader is removed from the
  trip; no in-page preview.
- **Concurrency:** last write wins on simultaneous edits; itinerary moves
  renumber the list so order stays consistent. One production test run saw a
  live update take longer than 10 seconds; it did not reproduce in later runs.
- **Itinerary** order is manual (not sorted by date/time); trips without a
  return date only check that planned dates are on or after the start.
- Scaffold leftovers: a dev-only `/api-status` page and AI chat routes that are
  not registered (the app doesn't declare the chat collections).

---

## Deployment and source

```bash
npx deepspace deploy        # requires a clean, committed worktree
npx deepspace releases      # release ledger
npx deepspace rollback <release-id>
```

### Source code

- **Public review copy (GitHub):** https://github.com/RaghavendraLingala/beforemiles — anyone can read it without
  signing in. It was created from a clean snapshot of DeepSpace commit
  `1c47e6a` with fresh Git history (no earlier history), and later
  documentation-only updates are pushed to both repositories.
- **Deployed application code:** commit `0531265`, release #15, at
  https://beforemiles.app.space. The snapshot differs from it only in
  documentation.
- **Canonical repository:** the app's **DeepSpace cloud repository**
  (git remote `space`, branch `main`):
  `https://deploy-worker.deep.space/api/repo/app_01M46SX8S4H1XGF30TX0PXJWM0`.
  It remains the source of truth and the only deployment source; the GitHub
  copy is for review and is not used for deployment. Cloning the DeepSpace
  repository requires being added as an app collaborator.
