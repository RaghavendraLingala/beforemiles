/**
 * Trip ownership, sharing, documents, and readiness reports — end to end, two users.
 *
 * Accounts (created once with `npx deepspace test accounts create`):
 *   routeready-a-01m46@deepspace.test  "RouteReady A"
 *   routeready-b-01m46@deepspace.test  "RouteReady B"
 *
 * The report-generation test makes a real, owner-billed model call, so it only
 * runs when RUN_AI_TESTS=1 is set.
 */
import type { Page } from '@playwright/test'
import { test as base, expect } from 'deepspace/testing'

const B_EMAIL = 'routeready-b-01m46@deepspace.test'

/**
 * Same \`users\` fixture, but every trip a test creates (any successful
 * createTrip call, UI or direct) is deleted when the test ends. Without this,
 * the test accounts pile up trips — and team access stops working for a user
 * in ~100 trips (the SDK puts every trip id in one SQL statement).
 */
const test = base.extend({
  // The fixture callback is usually named `use`; renamed so React's hooks lint doesn't mistake it for a hook.
  users: async ({ users }, provide) => {
    const created: { page: Page; tripId: string }[] = []
    const tracked: typeof users = async (...args) => {
      const list = await users(...args)
      for (const u of list) {
        u.page.on('response', async (res) => {
          if (!res.url().endsWith('/api/actions/createTrip') || !res.ok()) return
          const body = await res.json().catch(() => null)
          if (body?.success) created.push({ page: u.page, tripId: body.data.tripId })
        })
      }
      return list
    }
    await provide(tracked)
    for (const { page, tripId } of created) {
      // Owner-only; already-deleted trips just return an error, which is fine here.
      await callActionAs(page, 'deleteTrip', { tripId }).catch(() => undefined)
    }
  },
})

/** A creates a trip through the form; returns its name and /trips/:id path. */
async function createTrip(page: Page) {
  const tripName = `Coast run ${Date.now()}`
  await page.goto('/trips')
  await page.getByRole('button', { name: 'New trip' }).first().click()
  await page.getByLabel('Trip name').fill(tripName)
  await page.getByLabel('Start location').fill('San Francisco, CA')
  await page.getByLabel('Destination').fill('Big Sur, CA')
  await page.getByLabel('Travel start date').fill('2026-11-01')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('heading', { name: tripName })).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/trips\/[\w-]+$/)
  return { tripName, tripPath: new URL(page.url()).pathname }
}

/** Switches the trip page to one of its tabs. */
async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click()
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
  // The previous panel unmounts after its exit transition; wait so only one is in the DOM.
  await expect(page.getByRole('tabpanel')).toHaveCount(1)
}

async function shareWithB(page: Page, role: 'viewer' | 'editor') {
  await openTab(page, 'Members')
  await page.getByLabel('Share with a BeforeMiles user').fill(B_EMAIL)
  await page.getByLabel('Role').selectOption(role)
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(page.getByText('Trip shared')).toBeVisible()
}

/**
 * Calls a server action as whoever is signed in on `page`, bypassing the UI —
 * proves the server enforces roles, not just the hidden buttons. Imports the
 * app's own helper through the Vite dev server.
 */
async function callActionAs(page: Page, name: string, params: Record<string, unknown>) {
  return page.evaluate(
    async ([name, params]) => {
      const { callAction } = await import('/src/lib/actions.ts')
      return callAction(name, params)
    },
    [name, params] as const,
  )
}

test('trips are private until the owner shares them, then sync live', async ({ users }) => {
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])

  // B visits once so their users row exists (shareTrip looks users up by email).
  await b.page.goto('/trips')
  await expect(b.page.getByRole('heading', { name: 'Your trips' })).toBeVisible({ timeout: 15_000 })

  const { tripName, tripPath } = await createTrip(a.page)
  const tripId = tripPath.split('/').pop()!

  // B can't see it — not in the list, not by direct URL.
  await expect(b.page.getByText(tripName)).toHaveCount(0)
  await b.page.goto(tripPath)
  await expect(b.page.getByText("hasn't been shared with you")).toBeVisible({ timeout: 15_000 })

  // A shares with B as viewer; B's open page picks it up without a reload.
  await shareWithB(a.page, 'viewer')
  await expect(b.page.getByRole('heading', { name: tripName })).toBeVisible({ timeout: 15_000 })
  await expect(b.page.locator('header').getByText('viewer')).toBeVisible()

  // Viewer UI: no share form, no generate button.
  await openTab(b.page, 'Members')
  await expect(b.page.getByText('RouteReady A', { exact: true })).toBeVisible()
  await expect(b.page.getByLabel('Share with a BeforeMiles user')).toHaveCount(0)
  await openTab(b.page, 'Report')
  await expect(b.page.getByRole('button', { name: /generate report/i })).toHaveCount(0)
  await expect(b.page.getByText('The trip owner or an editor can generate one.')).toBeVisible()

  // Viewer API: the server refuses the same actions directly.
  const gen = await callActionAs(b.page, 'generateReport', { tripId })
  expect(gen).toMatchObject({ success: false, error: expect.stringMatching(/permission/i) })
  const share = await callActionAs(b.page, 'shareTrip', { tripId, email: B_EMAIL, role: 'editor' })
  expect(share).toMatchObject({ success: false, error: expect.stringMatching(/permission/i) })

  // The trip now shows up in B's list too.
  await b.page.goto('/trips')
  await expect(b.page.getByText(tripName)).toBeVisible({ timeout: 15_000 })
})

test('trip page tabs: overview by default, tab kept in the URL, empty states', async ({ users }) => {
  const [a] = await users(['RouteReady A'])
  const { tripPath } = await createTrip(a.page)

  await expect(a.page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  await expect(a.page.getByRole('heading', { name: 'Readiness score' })).toBeVisible()
  await expect(a.page.getByRole('heading', { name: 'Trip details' })).toBeVisible()

  // The selected tab is in the URL and survives a reload.
  await openTab(a.page, 'Documents')
  await expect(a.page).toHaveURL(`${tripPath}?tab=documents`)
  await a.page.reload()
  await expect(a.page.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true')
  await expect(a.page.getByRole('heading', { name: 'Documents' })).toBeVisible()

  // Before a report exists, Checklist offers manual items + a report link; Stops points to Report.
  await openTab(a.page, 'Checklist')
  await expect(a.page.getByText('Add your own items above')).toBeVisible()
  await openTab(a.page, 'Stops')
  await expect(a.page.getByText('No stop suggestions yet')).toBeVisible()
  await a.page.getByRole('button', { name: 'Go to Report' }).click()
  await expect(a.page.getByRole('heading', { name: 'Trip Readiness Report' })).toBeVisible()
  // Generated content is always labelled, with what it doesn't include nearby.
  await expect(a.page.getByText(AI_NOTICE)).toBeVisible()
  await expect(a.page.getByText('a live forecast, traffic, road closures, verified')).toBeVisible()

  // Itinerary starts empty; Help hosts the "What am I missing?" review.
  await openTab(a.page, 'Itinerary')
  await expect(a.page.getByRole('heading', { name: 'Itinerary', exact: true })).toBeVisible()
  await expect(a.page.getByText('No itinerary yet')).toBeVisible()
  await openTab(a.page, 'Help')
  await expect(a.page.getByRole('heading', { name: 'What am I missing?' })).toBeVisible()
  await expect(a.page.getByText('No review yet. Run one to see what this trip still needs.')).toBeVisible()
})

test('trip templates prefill the form and every field stays editable', async ({ users }) => {
  const [a] = await users(['RouteReady A'])
  const tripName = `Template run ${Date.now()}`
  await a.page.goto('/trips?new=1')
  const radio = (name: string) => a.page.getByRole('radio', { name, exact: true })
  const pref = (name: string) => a.page.getByRole('checkbox', { name, exact: true })

  // Defaults before any template.
  await expect(radio('leisure')).toBeChecked()
  await expect(radio('car')).toBeChecked()

  // Hiking fills type, mode and preferences.
  await a.page.getByRole('button', { name: 'Hiking trip' }).click()
  await expect(a.page.getByRole('button', { name: 'Hiking trip' })).toHaveAttribute('aria-pressed', 'true')
  await expect(radio('adventure')).toBeChecked()
  await expect(radio('walking')).toBeChecked()
  for (const p of ['hiking/walking', 'emergency centers', 'restrooms']) await expect(pref(p)).toBeChecked()
  await expect(pref('family-friendly')).not.toBeChecked()

  // Switching templates replaces the style; Clear restores defaults.
  await a.page.getByRole('button', { name: 'Business trip' }).click()
  await expect(radio('business')).toBeChecked()
  await expect(radio('flight')).toBeChecked()
  await expect(pref('hiking/walking')).not.toBeChecked()
  await a.page.getByRole('button', { name: 'Clear template' }).click()
  await expect(radio('leisure')).toBeChecked()
  await expect(radio('car')).toBeChecked()
  await expect(pref('restrooms')).not.toBeChecked()

  // Template, then hand edits — the edited values are what get saved. Scoped to
  // the form: trip cards below it can show the same words.
  const form = a.page.locator('form', { has: a.page.getByLabel('Trip name') })
  await a.page.getByRole('button', { name: 'Hiking trip' }).click()
  await form.getByText('bike', { exact: true }).click()
  await form.getByText('restrooms', { exact: true }).click()
  await a.page.getByLabel('Trip name').fill(tripName)
  await a.page.getByLabel('Start location').fill('Mill Valley, CA')
  await a.page.getByLabel('Destination').fill('Mount Tamalpais, CA')
  await a.page.getByLabel('Travel start date').fill('2026-11-08')
  await a.page.getByRole('button', { name: 'Create trip' }).click()

  await expect(a.page.getByRole('heading', { name: tripName })).toBeVisible({ timeout: 15_000 })
  await expect(a.page.getByText('adventure · bike')).toBeVisible()
  const details = a.page.locator('section', { has: a.page.getByRole('heading', { name: 'Trip details' }) })
  await expect(details.getByText('hiking/walking')).toBeVisible()
  await expect(details.getByText('emergency centers')).toBeVisible()
  await expect(details.getByText('restrooms', { exact: true })).toHaveCount(0)
})

test('trip dates: optional return date, ranges shown, invalid ranges refused', async ({ users }) => {
  const [a] = await users(['RouteReady A'])

  // No return date → a one-day trip shows a single date (existing behaviour).
  const { tripPath: oneDay } = await createTrip(a.page)
  await expect(a.page.locator('header')).not.toContainText(' – ')
  await expect(a.page.getByText('Travel date', { exact: true })).toBeVisible()
  const tripId = oneDay.split('/').pop()!

  // Valid return date → a range and the trip length, on the trip page and its card.
  const tripName = `Long weekend ${Date.now()}`
  await a.page.goto('/trips?new=1')
  await a.page.getByLabel('Trip name').fill(tripName)
  await a.page.getByLabel('Start location').fill('San Francisco, CA')
  await a.page.getByLabel('Destination').fill('Big Sur, CA')
  await a.page.getByLabel('Travel start date').fill('2026-11-01')
  await expect(a.page.getByLabel('Return date (optional)')).toHaveAttribute('min', '2026-11-01')
  await a.page.getByLabel('Return date (optional)').fill('2026-11-03')
  await a.page.getByRole('button', { name: 'Create trip' }).click()
  await expect(a.page.getByRole('heading', { name: tripName })).toBeVisible({ timeout: 15_000 })
  await expect(a.page.locator('header')).toContainText(/Nov 1 – .*Nov 3, 2026/)
  await expect(a.page.getByText('Dates', { exact: true })).toBeVisible()
  await expect(a.page.getByText(/Nov 1 – .*Nov 3, 2026 · 3 days/)).toBeVisible()
  await a.page.goto('/trips')
  await expect(a.page.locator('a[href^="/trips/"]', { hasText: tripName })).toContainText('3 days')

  // The server refuses a return date before the start date, and impossible dates.
  const base = {
    name: 'Bad dates', startLocation: 'A', destination: 'B', tripType: 'leisure', travelMode: 'car', travelers: 1,
  }
  expect(await callActionAs(a.page, 'createTrip', { ...base, travelDate: '2026-11-03', endDate: '2026-11-01' }))
    .toMatchObject({ success: false, error: expect.stringMatching(/before the start date/) })
  expect(await callActionAs(a.page, 'createTrip', { ...base, travelDate: '2026-02-31' }))
    .toMatchObject({ success: false, error: expect.stringMatching(/valid date/) })
  // Same-day return is allowed and still reads as a one-day trip.
  const sameDay = await callActionAs(a.page, 'createTrip', { ...base, travelDate: '2026-11-03', endDate: '2026-11-03' })
  expect(sameDay).toMatchObject({ success: true })

  // The existing one-day trip still opens normally.
  await a.page.goto(`/trips/${tripId}`)
  await expect(a.page.getByRole('heading', { name: 'Trip details' })).toBeVisible({ timeout: 15_000 })
})

async function addItineraryItem(page: Page, item: { title: string; type: string; date?: string; time?: string; location?: string }) {
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByLabel('Title', { exact: true }).fill(item.title)
  await page.getByLabel('Type', { exact: true }).selectOption(item.type)
  if (item.date) await page.getByLabel('Date (optional)').fill(item.date)
  if (item.time) await page.getByLabel('Time (optional)').fill(item.time)
  if (item.location) await page.getByLabel('Location (optional)').fill(item.location)
  await page.getByRole('button', { name: 'Add to timeline' }).click()
  await expect(page.getByRole('button', { name: 'Add to timeline' })).toHaveCount(0, { timeout: 10_000 })
}

const timelineTitles = (page: Page) =>
  page.getByTestId('itinerary-item').locator('span.font-semibold').allInnerTexts()

test('itinerary: editors build an ordered timeline that syncs live; viewers are read-only', async ({ users }) => {
  test.setTimeout(90_000)
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])
  await b.page.goto('/trips')

  // A three-day trip (Nov 1-3).
  const tripName = `Timeline trip ${Date.now()}`
  await a.page.goto('/trips?new=1')
  await a.page.getByLabel('Trip name').fill(tripName)
  await a.page.getByLabel('Start location').fill('San Francisco, CA')
  await a.page.getByLabel('Destination').fill('Big Sur, CA')
  await a.page.getByLabel('Travel start date').fill('2026-11-01')
  await a.page.getByLabel('Return date (optional)').fill('2026-11-03')
  await a.page.getByRole('button', { name: 'Create trip' }).click()
  await expect(a.page.getByRole('heading', { name: tripName })).toBeVisible({ timeout: 15_000 })
  const tripPath = new URL(a.page.url()).pathname
  const tripId = tripPath.split('/').pop()!
  await shareWithB(a.page, 'viewer')
  await b.page.goto(`${tripPath}?tab=itinerary`)
  await expect(b.page.getByText('The trip owner or an editor can build the timeline.')).toBeVisible({ timeout: 15_000 })

  // The date picker is limited to the trip's dates.
  await openTab(a.page, 'Itinerary')
  await a.page.getByRole('button', { name: 'Add item' }).click()
  await expect(a.page.getByLabel('Date (optional)')).toHaveAttribute('min', '2026-11-01')
  await expect(a.page.getByLabel('Date (optional)')).toHaveAttribute('max', '2026-11-03')
  await a.page.getByRole('button', { name: 'Cancel' }).click()

  // Owner adds three items; the viewer sees them live, in order, with day labels.
  await addItineraryItem(a.page, { title: 'Leave San Francisco', type: 'start', date: '2026-11-01', time: '08:00', location: 'San Francisco, CA' })
  await addItineraryItem(a.page, { title: 'Lunch in Monterey', type: 'food', date: '2026-11-01', time: '12:30' })
  await addItineraryItem(a.page, { title: 'Arrive Big Sur', type: 'destination', date: '2026-11-02' })
  await expect.poll(() => timelineTitles(b.page), { timeout: 10_000 })
    .toEqual(['Leave San Francisco', 'Lunch in Monterey', 'Arrive Big Sur'])
  const leave = b.page.getByTestId('itinerary-item').filter({ hasText: 'Leave San Francisco' })
  await expect(leave).toContainText('Day 1')
  await expect(leave).toContainText('08:00')
  await expect(leave).toContainText('San Francisco, CA')
  await expect(b.page.getByTestId('itinerary-item').filter({ hasText: 'Arrive Big Sur' })).toContainText('Day 2')

  // Reorder: move "Arrive Big Sur" up -> order changes for the viewer.
  await a.page.getByRole('button', { name: 'Move up: Arrive Big Sur' }).click()
  await expect.poll(() => timelineTitles(b.page), { timeout: 10_000 })
    .toEqual(['Leave San Francisco', 'Arrive Big Sur', 'Lunch in Monterey'])
  await expect(a.page.getByRole('button', { name: 'Move up: Leave San Francisco' })).toBeDisabled()

  // Edit: rename and add a note -> viewer sees it.
  await a.page.getByRole('button', { name: 'Edit: Lunch in Monterey' }).click()
  await a.page.getByLabel('Title', { exact: true }).fill('Lunch in Carmel')
  await a.page.getByLabel('Notes (optional)').fill('Table for 1 at 12:30')
  await a.page.getByRole('button', { name: 'Save changes' }).click()
  await expect(b.page.getByTestId('itinerary-item').filter({ hasText: 'Lunch in Carmel' })).toContainText('Table for 1', { timeout: 10_000 })

  // Viewer: no controls, and every itinerary action is refused server-side.
  await expect(b.page.getByRole('button', { name: 'Add item' })).toHaveCount(0)
  await expect(b.page.getByRole('button', { name: /^(Move up|Move down|Edit|Remove):/ })).toHaveCount(0)
  const itemId = await b.page.getByTestId('itinerary-item').first().getAttribute('data-record-id')
  const refused = { success: false, error: expect.stringMatching(/permission/i) }
  expect(await callActionAs(b.page, 'addItineraryItem', { tripId, title: 'Sneaky', itemType: 'custom' })).toMatchObject(refused)
  expect(await callActionAs(b.page, 'updateItineraryItem', { itemId, title: 'Hacked', itemType: 'custom' })).toMatchObject(refused)
  expect(await callActionAs(b.page, 'moveItineraryItem', { itemId, direction: 'down' })).toMatchObject(refused)
  expect(await callActionAs(b.page, 'removeItineraryItem', { itemId })).toMatchObject(refused)

  // Server validation: dates outside the trip and bad times are refused.
  expect(await callActionAs(a.page, 'addItineraryItem', { tripId, title: 'Too late', itemType: 'custom', plannedDate: '2026-11-04' }))
    .toMatchObject({ success: false, error: expect.stringMatching(/after the trip ends/) })
  expect(await callActionAs(a.page, 'addItineraryItem', { tripId, title: 'Bad time', itemType: 'custom', plannedTime: '25:00' }))
    .toMatchObject({ success: false, error: expect.stringMatching(/HH:MM/) })

  // Remove (with confirmation) -> gone for the viewer.
  await a.page.getByRole('button', { name: 'Remove: Arrive Big Sur' }).click()
  await a.page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect.poll(() => timelineTitles(b.page), { timeout: 10_000 }).toEqual(['Leave San Francisco', 'Lunch in Carmel'])

  // Promoted to editor -> B can add.
  await shareWithB(a.page, 'editor')
  await expect(b.page.getByRole('button', { name: 'Add item' })).toBeVisible({ timeout: 15_000 })
  await addItineraryItem(b.page, { title: 'Fuel up in Carmel', type: 'fuel' })
  await openTab(a.page, 'Itinerary')
  await expect.poll(() => timelineTitles(a.page), { timeout: 10_000 })
    .toEqual(['Leave San Francisco', 'Lunch in Carmel', 'Fuel up in Carmel'])
})

test('settings: account, privacy, and saved trip defaults that prefill New trip', async ({ users }) => {
  test.setTimeout(60_000)
  // RouteReady B: the template test relies on RouteReady A keeping app defaults.
  const [b] = await users(['RouteReady B'])
  const page = b.page
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('settings-name')).toHaveText('RouteReady B')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByText('Trips are private by default.')).toBeVisible()
  await expect(page.getByText('Not included yet')).toBeVisible()

  // Save defaults: train, 3 travelers, restrooms, detailed report style.
  await page.getByText('train', { exact: true }).click()
  await page.getByLabel('Default travelers').fill('3')
  await page.getByText('restrooms', { exact: true }).click()
  await page.getByText('Fuller explanations with a reason behind each suggestion.').click()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByText('Preferences saved')).toBeVisible()

  // Persisted to the account: still there after a reload.
  await page.reload()
  await expect(page.getByRole('radio', { name: 'train', exact: true })).toBeChecked({ timeout: 15_000 })
  await expect(page.getByLabel('Default travelers')).toHaveValue('3')
  await expect(page.getByRole('checkbox', { name: 'restrooms', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: /detailed/i })).toBeChecked()

  // New trip starts from those defaults; a template overrides; Clear returns to them.
  await page.goto('/trips?new=1')
  const radio = (name: string) => page.getByRole('radio', { name, exact: true })
  await expect(radio('train')).toBeChecked({ timeout: 15_000 })
  await expect(page.getByLabel('Travelers')).toHaveValue('3')
  await expect(page.getByRole('checkbox', { name: 'restrooms', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Hiking trip' }).click()
  await expect(radio('walking')).toBeChecked()
  await page.getByRole('button', { name: 'Clear template' }).click()
  await expect(radio('train')).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'restrooms', exact: true })).toBeChecked()

  // The server validates every value.
  expect(await callActionAs(page, 'saveUserPreferences', {
    defaultTravelMode: 'rocket', defaultTravelers: 1, defaultPreferences: [], aiStyle: 'concise',
  })).toMatchObject({ success: false, error: 'Unknown travel mode.' })
  expect(await callActionAs(page, 'saveUserPreferences', {
    defaultTravelMode: 'car', defaultTravelers: 0, defaultPreferences: [], aiStyle: 'concise',
  })).toMatchObject({ success: false, error: expect.stringMatching(/1 to 50/) })

  // Reset B to app defaults so later runs start clean.
  expect(await callActionAs(page, 'saveUserPreferences', {
    defaultTravelMode: 'car', defaultTravelers: 1, defaultPreferences: [], aiStyle: 'concise',
  })).toMatchObject({ success: true })
})

async function addManualItem(page: Page, text: string, category: string, assignee = '') {
  await page.getByLabel('New checklist item').fill(text)
  await page.getByLabel('Category').selectOption(category)
  await page.getByLabel('Assign to (optional)').fill(assignee)
  await page.getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByLabel('New checklist item')).toHaveValue('', { timeout: 10_000 })
}

test('manual checklist items and assignments: editors add and assign, viewers read live', async ({ users }) => {
  test.setTimeout(90_000)
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])
  await b.page.goto('/trips')
  const { tripPath } = await createTrip(a.page)
  const tripId = tripPath.split('/').pop()!
  await shareWithB(a.page, 'viewer')
  await b.page.goto(`${tripPath}?tab=checklist`)
  await expect(b.page.getByText('No checklist yet')).toBeVisible({ timeout: 15_000 })

  // Owner adds a manual item assigned to Sam → viewer sees it live, labelled Manual.
  await openTab(a.page, 'Checklist')
  await addManualItem(a.page, 'Book the dog sitter', 'planning', 'Sam')
  const row = (page: Page) => page.locator('li[data-record-id]', { hasText: 'Book the dog sitter' })
  await expect(row(b.page)).toBeVisible({ timeout: 15_000 })
  await expect(row(b.page).getByText('Manual')).toBeVisible()
  await expect(row(b.page).getByTestId('assignee')).toHaveText('Sam')
  await expect(b.page.getByRole('heading', { name: 'planning' })).toBeVisible()

  // Viewer UI: no add form, no assignment controls, checkbox disabled.
  await expect(b.page.getByLabel('New checklist item')).toHaveCount(0)
  await expect(b.page.getByRole('button', { name: /^Assign:/ })).toHaveCount(0)
  await expect(row(b.page).locator('input[type=checkbox]')).toBeDisabled()

  // Viewer API: both new actions are refused directly.
  const itemId = await row(b.page).getAttribute('data-record-id')
  expect(await callActionAs(b.page, 'addManualChecklistItem', { tripId, text: 'Sneaky item', category: 'packing' }))
    .toMatchObject({ success: false, error: expect.stringMatching(/permission/i) })
  expect(await callActionAs(b.page, 'updateChecklistItemAssignment', { itemId, assignedToName: 'Mallory' }))
    .toMatchObject({ success: false, error: expect.stringMatching(/permission/i) })
  await expect(row(b.page).getByTestId('assignee')).toHaveText('Sam')

  // Owner reassigns, then clears → viewer follows live.
  await a.page.getByRole('button', { name: 'Assign: Book the dog sitter' }).click()
  await a.page.getByLabel('Assignee for: Book the dog sitter').fill('Alex')
  await a.page.getByRole('button', { name: 'Save' }).click()
  await expect(row(b.page).getByTestId('assignee')).toHaveText('Alex', { timeout: 10_000 })
  await a.page.getByRole('button', { name: 'Assign: Book the dog sitter' }).click()
  await a.page.getByLabel('Assignee for: Book the dog sitter').fill('')
  await a.page.getByRole('button', { name: 'Save' }).click()
  await expect(row(b.page).getByTestId('assignee')).toHaveCount(0, { timeout: 10_000 })

  // Manual items count toward the readiness score like any other item.
  await row(a.page).locator('input[type=checkbox]').check()
  await expect(row(b.page).locator('input[type=checkbox]')).toBeChecked({ timeout: 10_000 })
  await openTab(b.page, 'Overview')
  await expect(b.page.getByTestId('readiness-score')).toHaveText('80')

  // Empty text is refused server-side too.
  expect(await callActionAs(a.page, 'addManualChecklistItem', { tripId, text: '   ', category: 'packing' }))
    .toMatchObject({ success: false, error: 'Item text is required.' })

  // Promoted to editor → B can add and assign.
  await shareWithB(a.page, 'editor')
  await openTab(b.page, 'Checklist')
  await expect(b.page.getByLabel('New checklist item')).toBeVisible({ timeout: 15_000 })
  await addManualItem(b.page, "Pack the kids' tablets", 'packing')
  await b.page.getByRole('button', { name: "Assign: Pack the kids' tablets" }).click()
  await b.page.getByLabel("Assignee for: Pack the kids' tablets").fill('Jordan')
  await b.page.getByRole('button', { name: 'Save' }).click()
  await openTab(a.page, 'Checklist')
  await expect(row(a.page).getByText('Manual')).toBeVisible()
  await expect(
    a.page.locator('li[data-record-id]', { hasText: "Pack the kids' tablets" }).getByTestId('assignee'),
  ).toHaveText('Jordan', { timeout: 10_000 })
})

const AI_NOTICE = 'AI-generated planning suggestions. Check important details before you travel.'
const REVIEW_NOTE = AI_NOTICE

test('"What am I missing?": owners/editors can run it, viewers read only and are refused', async ({ users }) => {
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])
  await b.page.goto('/trips')
  const { tripPath } = await createTrip(a.page)
  const tripId = tripPath.split('/').pop()!
  await shareWithB(a.page, 'viewer')

  // Owner sees the button and the planning-guidance note.
  await openTab(a.page, 'Help')
  await expect(a.page.getByRole('button', { name: 'What am I missing?' })).toBeVisible()
  await expect(a.page.getByText(REVIEW_NOTE)).toBeVisible()
  await expect(a.page.getByText('not live weather, traffic, verified places, or emergency data')).toBeVisible()

  // Viewer sees the note and an explanation, but no button — and the server refuses a direct call.
  await b.page.goto(`${tripPath}?tab=help`)
  await expect(b.page.getByText(REVIEW_NOTE)).toBeVisible({ timeout: 15_000 })
  await expect(b.page.getByText('No review yet. The trip owner or an editor can run one.')).toBeVisible()
  await expect(b.page.getByRole('button', { name: /What am I missing|Review again/ })).toHaveCount(0)
  expect(await callActionAs(b.page, 'generateReadinessReview', { tripId })).toMatchObject({
    success: false,
    error: expect.stringMatching(/permission/i),
  })
})

test('"What am I missing?" review renders, syncs to a viewer, and feeds the checklist', async ({ users }) => {
  test.skip(process.env.RUN_AI_TESTS !== '1', 'Set RUN_AI_TESTS=1 to run the real model call.')
  test.setTimeout(150_000)
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])
  await b.page.goto('/trips')
  const { tripPath } = await createTrip(a.page)
  await shareWithB(a.page, 'viewer')
  await b.page.goto(`${tripPath}?tab=help`)
  await expect(b.page.getByText('No review yet.', { exact: false })).toBeVisible({ timeout: 15_000 })

  await openTab(a.page, 'Help')
  await a.page.getByRole('button', { name: 'What am I missing?' }).click()
  await expect(a.page.getByText('Review ready')).toBeVisible({ timeout: 120_000 })

  // 3–5 prioritized suggestions, each with a reason and suggested action; viewer gets them live.
  for (const page of [a.page, b.page]) {
    const cards = page.getByTestId('review-suggestion')
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(3)
    expect(count).toBeLessThanOrEqual(5)
    await expect(cards.first().getByText(/^(high|medium|low)$/)).toBeVisible()
    await expect(cards.first().getByText('Suggested action:')).toBeVisible()
  }
  await expect(b.page.getByRole('button', { name: /^Add to checklist/ })).toHaveCount(0)

  // Owner adds the first suggestion to the checklist → marked as added; the viewer's checklist has it.
  const first = a.page.getByTestId('review-suggestion').first()
  await first.getByRole('button', { name: /^Add to checklist/ }).click()
  await expect(first.getByText('On checklist')).toBeVisible({ timeout: 10_000 })
  await openTab(b.page, 'Checklist')
  await expect(b.page.locator('li[data-record-id]').filter({ hasText: 'Manual' })).toHaveCount(1, { timeout: 10_000 })

  // Immediate re-run is refused by the cooldown.
  await a.page.getByRole('button', { name: 'Review again' }).click()
  await expect(a.page.getByText('A review was just run')).toBeVisible()
})

/** Fetches a document through the membership-checked route as whoever is signed in. */
async function fetchDocumentAs(page: Page, documentId: string) {
  return page.evaluate(async (documentId) => {
    const { fetchTripDocument } = await import('/src/lib/documents.ts')
    const res = await fetchTripDocument(documentId)
    return { status: res.status, text: res.ok ? await res.text() : '' }
  }, documentId)
}

async function uploadDocument(page: Page, name: string, body: string, type: string) {
  await openTab(page, 'Documents')
  await page.getByLabel('Add a document (max 10 MB)').setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from(body),
  })
  await page.getByLabel('Document type').selectOption(type)
  await page.getByRole('button', { name: 'Upload' }).click()
  await expect(page.getByText('Document added')).toBeVisible({ timeout: 20_000 })
}

test('trip documents are private to members and only owners/editors can add them', async ({ users }) => {
  test.setTimeout(90_000)
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])
  await b.page.goto('/trips')
  const { tripPath } = await createTrip(a.page)
  const tripId = tripPath.split('/').pop()!

  // Owner uploads through the UI; the metadata row appears in the list.
  await uploadDocument(a.page, 'boarding-pass.txt', 'Seat 12A', 'ticket')
  const aRow = a.page.getByTestId('document-list').locator('li', { hasText: 'boarding-pass.txt' })
  await expect(aRow).toBeVisible()
  await expect(aRow.getByText('ticket')).toBeVisible()
  const documentId = (await aRow.getAttribute('data-record-id'))!

  // Not a member yet → the file route refuses B.
  expect((await fetchDocumentAs(b.page, documentId)).status).toBe(404)

  // Shared as viewer → B sees the document live and can open it, but can't add one.
  await shareWithB(a.page, 'viewer')
  await b.page.goto(`${tripPath}?tab=documents`)
  await expect(b.page.getByText('boarding-pass.txt')).toBeVisible({ timeout: 15_000 })
  await expect(b.page.getByLabel('Add a document (max 10 MB)')).toHaveCount(0)
  expect(await fetchDocumentAs(b.page, documentId)).toEqual({ status: 200, text: 'Seat 12A' })
  const download = b.page.waitForEvent('download')
  await b.page.getByRole('button', { name: 'Download boarding-pass.txt' }).click()
  expect((await download).suggestedFilename()).toBe('boarding-pass.txt')

  const viewerAdd = await callActionAs(b.page, 'addTripDocument', {
    tripId,
    fileKey: `apps/x/users/y/trips/${tripId}/note.txt`,
    fileName: 'note.txt',
    size: 10,
    documentType: 'other',
  })
  expect(viewerAdd).toMatchObject({ success: false, error: expect.stringMatching(/permission/i) })

  // Promoted to editor → B's open Documents tab gains the upload form live;
  // B uploads, and A sees it live and can open it.
  await shareWithB(a.page, 'editor')
  await expect(b.page.getByLabel('Add a document (max 10 MB)')).toBeVisible({ timeout: 15_000 })
  await openTab(a.page, 'Documents')
  await uploadDocument(b.page, 'permit.txt', 'Permit #42', 'permit')
  const bDocRow = a.page.getByTestId('document-list').locator('li', { hasText: 'permit.txt' })
  await expect(bDocRow).toBeVisible({ timeout: 15_000 })
  const bDocId = (await bDocRow.getAttribute('data-record-id'))!
  expect(await fetchDocumentAs(a.page, bDocId)).toEqual({ status: 200, text: 'Permit #42' })

  // An editor can't attach a file that isn't in their own folder for this trip.
  const forged = await callActionAs(b.page, 'addTripDocument', {
    tripId,
    fileKey: `apps/whatever/users/someone-else/trips/${tripId}/boarding-pass.txt`,
    fileName: 'stolen.txt',
    size: 8,
    documentType: 'other',
  })
  expect(forged).toMatchObject({ success: false, error: 'That file was not uploaded by you for this trip.' })
})

test('report, checklist, stops and score work together and sync to a viewer', async ({ users }) => {
  test.skip(process.env.RUN_AI_TESTS !== '1', 'Set RUN_AI_TESTS=1 to run the real model call.')
  test.setTimeout(180_000)
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])
  const both = async (fn: (page: Page) => Promise<void>) => Promise.all([fn(a.page), fn(b.page)])

  await b.page.goto('/trips')
  const { tripPath } = await createTrip(a.page)
  await shareWithB(a.page, 'viewer')
  await b.page.goto(tripPath)
  await expect(b.page.getByText('Generate a report to get a checklist and a readiness score.')).toBeVisible({
    timeout: 15_000,
  })

  // Owner generates; the report reaches the viewer's open Report tab live.
  await both((page) => openTab(page, 'Report'))
  await expect(b.page.getByText('No report yet.')).toBeVisible()
  await a.page.getByRole('button', { name: 'Generate report' }).click()
  await expect(a.page.getByText('Report ready')).toBeVisible({ timeout: 120_000 })
  await both((page) => expect(page.getByRole('heading', { name: 'What to carry' })).toBeVisible({ timeout: 15_000 }))
  await both(async (page) => {
    await openTab(page, 'Overview')
    await expect(page.getByTestId('readiness-score')).toHaveText('0')
  })

  // Checklist: viewer read-only; owner checks → viewer sees it checked and attributed.
  await both((page) => openTab(page, 'Checklist'))
  const firstItem = (page: Page) =>
    page.locator('li[data-record-id]').filter({ has: page.locator('input[type=checkbox]') }).first()
  await expect(firstItem(b.page).locator('input')).toBeDisabled()
  await firstItem(a.page).locator('input').check()
  await expect(firstItem(b.page).locator('input')).toBeChecked({ timeout: 10_000 })
  await expect(firstItem(b.page).getByText('Checked by RouteReady A')).toBeVisible()
  const itemId = await firstItem(b.page).getAttribute('data-record-id')

  // Stops: viewer has no Save buttons; owner saves → it moves to the viewer's Saved stops.
  await both((page) => openTab(page, 'Stops'))
  await expect(b.page.getByRole('button', { name: /^Save stop:/ })).toHaveCount(0)
  await a.page.getByRole('button', { name: /^Save stop:/ }).first().click()
  const bSaved = b.page.getByTestId('saved-stops').getByTestId('stop-card')
  await expect(bSaved).toHaveCount(1, { timeout: 10_000 })
  await expect(bSaved.getByText('Saved by RouteReady A')).toBeVisible()
  const stopId = await bSaved.first().getAttribute('data-record-id')

  // A saved stop can be added to the itinerary once.
  await a.page.getByRole('button', { name: /^Add to itinerary:/ }).first().click()
  await expect(a.page.getByTestId('saved-stops').getByText('In itinerary')).toBeVisible({ timeout: 10_000 })
  await openTab(b.page, 'Itinerary')
  await expect(b.page.getByTestId('itinerary-item')).toHaveCount(1, { timeout: 10_000 })
  await openTab(b.page, 'Stops')

  // Score moved and matches for both users.
  await both((page) => openTab(page, 'Overview'))
  await expect(b.page.getByTestId('readiness-score')).not.toHaveText('0')
  await expect(a.page.getByTestId('readiness-score')).toHaveText(await b.page.getByTestId('readiness-score').innerText())

  // Viewer API: direct calls on real rows are refused by the server.
  expect(await callActionAs(b.page, 'setChecklistItemChecked', { itemId, checked: false })).toMatchObject({
    success: false,
    error: expect.stringMatching(/permission/i),
  })
  expect(await callActionAs(b.page, 'setStopSaved', { stopId, saved: false })).toMatchObject({
    success: false,
    error: expect.stringMatching(/permission/i),
  })

  // Owner unchecks and unsaves → both sync back.
  await both((page) => openTab(page, 'Checklist'))
  await expect(firstItem(b.page).locator('input')).toBeChecked()
  await firstItem(a.page).locator('input').uncheck()
  await expect(firstItem(b.page).locator('input')).not.toBeChecked({ timeout: 10_000 })
  await both((page) => openTab(page, 'Stops'))
  await a.page.getByRole('button', { name: /^Unsave stop:/ }).first().click()
  await expect(bSaved).toHaveCount(0, { timeout: 10_000 })
  await openTab(b.page, 'Overview')
  await expect(b.page.getByTestId('readiness-score')).toHaveText('0')

  // Immediate regenerate is refused by the cooldown.
  await openTab(a.page, 'Report')
  await a.page.getByRole('button', { name: 'Regenerate' }).click()
  await expect(a.page.getByText('A report was just generated')).toBeVisible()
})

/** Lists the signed-in user's private file keys under a prefix (relative to their scope). */
async function listOwnFileKeys(page: Page, prefix: string) {
  return page.evaluate(async (prefix) => {
    const { authHeaders } = await import('/src/lib/actions.ts')
    const res = await fetch('/api/files?scope=self&prefix=' + encodeURIComponent(prefix), { headers: await authHeaders() })
    const body = await res.json()
    const files = (body.files ?? body.data?.files ?? []) as { key: string }[]
    return files.map((f) => f.key)
  }, prefix)
}

test('deletes: items, documents, members, and trips — scoped by role and enforced on the server', async ({ users }) => {
  test.setTimeout(120_000)
  const [a, b] = await users(['RouteReady A', 'RouteReady B'])
  await b.page.goto('/trips')
  const { tripName, tripPath } = await createTrip(a.page)
  const tripId = tripPath.split('/').pop()!
  await shareWithB(a.page, 'viewer')
  const refused = { success: false, error: expect.stringMatching(/permission/i) }

  // Owner adds a manual item and uploads a document.
  await openTab(a.page, 'Checklist')
  await addManualItem(a.page, 'Pack snacks', 'packing')
  await uploadDocument(a.page, 'hotel.txt', 'Room 4', 'booking')
  const docRow = (page: Page) => page.getByTestId('document-list').locator('li', { hasText: 'hotel.txt' })
  const documentId = (await docRow(a.page).getAttribute('data-record-id'))!
  await uploadDocument(a.page, 'keep.txt', 'Still here', 'other')
  const keptDocumentId = (await a.page.getByTestId('document-list').locator('li', { hasText: 'keep.txt' }).getAttribute('data-record-id'))!

  // Viewer: no delete controls, and every delete is refused server-side.
  await b.page.goto(`${tripPath}?tab=checklist`)
  const itemRow = (page: Page) => page.locator('li[data-record-id]', { hasText: 'Pack snacks' })
  await expect(itemRow(b.page)).toBeVisible({ timeout: 15_000 })
  await expect(b.page.getByRole('button', { name: /^Delete item:/ })).toHaveCount(0)
  const itemId = await itemRow(b.page).getAttribute('data-record-id')
  expect(await callActionAs(b.page, 'deleteManualChecklistItem', { itemId })).toMatchObject(refused)
  await openTab(b.page, 'Documents')
  await expect(docRow(b.page)).toBeVisible()
  await expect(b.page.getByRole('button', { name: /^Delete document:/ })).toHaveCount(0)
  expect(await callActionAs(b.page, 'deleteTripDocument', { documentId })).toMatchObject(refused)
  await openTab(b.page, 'Members')
  await expect(b.page.getByRole('button', { name: /^Remove member:/ })).toHaveCount(0)
  const ownerMembershipId = await b.page.getByTestId('member-row').filter({ hasText: 'RouteReady A' }).getAttribute('data-record-id')
  expect(await callActionAs(b.page, 'removeTripMember', { membershipId: ownerMembershipId })).toMatchObject(refused)
  expect(await callActionAs(b.page, 'deleteTrip', { tripId })).toMatchObject(refused)
  await openTab(b.page, 'Overview')
  await expect(b.page.getByRole('button', { name: 'Delete trip' })).toHaveCount(0)

  // Editor: can delete the manual item and the document (file included), but not the trip.
  await shareWithB(a.page, 'editor')
  expect(await callActionAs(b.page, 'deleteTrip', { tripId })).toMatchObject(refused)
  await openTab(b.page, 'Checklist')
  await b.page.getByRole('button', { name: 'Delete item: Pack snacks' }).click()
  await b.page.getByRole('button', { name: 'Delete item', exact: true }).click()
  await openTab(a.page, 'Checklist')
  await expect(itemRow(a.page)).toHaveCount(0, { timeout: 10_000 })

  expect(await listOwnFileKeys(a.page, `trips/${tripId}/`)).toHaveLength(2)
  await openTab(b.page, 'Documents')
  await b.page.getByRole('button', { name: 'Delete document: hotel.txt' }).click()
  await b.page.getByRole('button', { name: 'Delete document', exact: true }).click()
  await openTab(a.page, 'Documents')
  await expect(docRow(a.page)).toHaveCount(0, { timeout: 10_000 })
  expect(await fetchDocumentAs(a.page, documentId)).toMatchObject({ status: 404 })
  // The private file is gone from the uploader's storage, not just the metadata.
  expect(await listOwnFileKeys(a.page, `trips/${tripId}/`)).toHaveLength(1)

  // Owner can't remove themselves.
  expect(await callActionAs(a.page, 'removeTripMember', { membershipId: ownerMembershipId }))
    .toMatchObject({ success: false, error: expect.stringMatching(/can’t be removed/) })

  // Owner removes B → B loses access live and the trip leaves B's list.
  await b.page.goto(tripPath)
  await expect(b.page.getByRole('heading', { name: tripName })).toBeVisible({ timeout: 15_000 })
  await openTab(a.page, 'Members')
  await a.page.getByRole('button', { name: 'Remove member: RouteReady B' }).click()
  await a.page.getByRole('button', { name: 'Remove member', exact: true }).click()
  await expect(b.page.getByRole('heading', { name: 'Trip not available' })).toBeVisible({ timeout: 15_000 })
  // Server-side: the trip's records no longer reach B (the page above), an existing document id
  // returns 404 from the file route, and writes are refused.
  expect(await fetchDocumentAs(b.page, keptDocumentId)).toMatchObject({ status: 404 })
  expect(await fetchDocumentAs(a.page, keptDocumentId)).toEqual({ status: 200, text: 'Still here' })
  expect(await callActionAs(b.page, 'addManualChecklistItem', { tripId, text: 'After removal', category: 'packing' }))
    .toMatchObject(refused)
  await b.page.goto('/trips')
  await expect(b.page.getByRole('heading', { name: 'Your trips' })).toBeVisible({ timeout: 15_000 })
  await expect(b.page.getByText(tripName)).toHaveCount(0)

  // A second trip with its own document, which deleting the first must not touch.
  const other = await createTrip(a.page)
  await uploadDocument(a.page, 'other-trip.txt', 'Other trip file', 'other')
  const otherTripId = other.tripPath.split('/').pop()!
  const otherDocId = (await a.page.getByTestId('document-list').locator('li', { hasText: 'other-trip.txt' }).getAttribute('data-record-id'))!
  await a.page.goto(tripPath)

  // Owner deletes the trip → redirected to /trips, and the trip is gone.
  await openTab(a.page, 'Overview')
  await a.page.getByRole('button', { name: 'Delete trip' }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete trip' }).click()
  await expect(a.page).toHaveURL(/\/trips$/, { timeout: 15_000 })
  // Scoped to trip cards: the "Trip deleted" toast also shows the trip's name.
  await expect(a.page.locator('a[href^="/trips/"]', { hasText: tripName })).toHaveCount(0)
  await expect(a.page.locator('a[href^="/trips/"]', { hasText: other.tripName })).toBeVisible()
  expect(await fetchDocumentAs(a.page, otherDocId)).toEqual({ status: 200, text: 'Other trip file' })
  expect(await listOwnFileKeys(a.page, `trips/${otherTripId}/`)).toHaveLength(1)
  expect(await listOwnFileKeys(a.page, `trips/${tripId}/`)).toHaveLength(0)
  expect(await fetchDocumentAs(a.page, keptDocumentId)).toMatchObject({ status: 404 })
  await a.page.goto(tripPath)
  await expect(a.page.getByRole('heading', { name: 'Trip not available' })).toBeVisible({ timeout: 15_000 })
})
