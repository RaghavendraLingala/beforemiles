/**
 * Server actions — the only write path for trips and memberships.
 *
 * Actions run with RBAC bypassed (see /guides/server-actions), so each one
 * must check the caller's trip role itself via `requireTripRole` before
 * writing. Writes still broadcast through the RecordRoom, so every member's
 * `useQuery` updates live.
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  TRAVEL_MODES,
  TRIP_PREFERENCES,
  TRIP_TYPES,
  type Trip,
} from '../schemas/trips-schema'
import type { TeamMember, TripRole } from '../schemas/team-members-schema'
import type { Report } from '../schemas/reports-schema'
import { CHECKLIST_CATEGORIES, type ChecklistCategory, type ChecklistItem } from '../schemas/checklist-items-schema'
import type { StopSuggestion } from '../schemas/stop-suggestions-schema'
import { generateReadiness, READINESS_MODEL } from '../ai/readiness'
import { planRegeneration } from '../lib/regeneration'
import { isIsoDate } from '../lib/format'
import { parseItineraryFields, planMove } from '../lib/itinerary'
import type { ItineraryItem } from '../schemas/itinerary-items-schema'
import { AI_STYLES, type AiStyle, type UserPreferences } from '../schemas/user-preferences-schema'
import { deletePrivateFile } from '../server/private-files'
import { requireTripRole } from '../server/trip-access'
import { deleteTripAndData } from '../server/trip-deletion'
import { computeReadinessScore } from '../lib/readiness-score'
import { REVIEW_MODEL, reviewTripReadiness } from '../ai/readiness-review'
import type { ReadinessReview } from '../schemas/readiness-reviews-schema'
import {
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentType,
  type TripDocument,
} from '../schemas/trip-documents-schema'

export { requireTripRole }

// ── Input validation ─────────────────────────────────────────────────────────

function text(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function parseTrip(params: Record<string, unknown>): Omit<Trip, 'tripId'> | string {
  const name = text(params.name)
  const startLocation = text(params.startLocation, 200)
  const destination = text(params.destination, 200)
  if (!name || !startLocation || !destination) {
    return 'Trip name, start location and destination are required.'
  }

  const travelDate = text(params.travelDate, 10)
  if (!isIsoDate(travelDate)) return 'Travel start date must be a valid date (YYYY-MM-DD).'
  const endDate = text(params.endDate, 10)
  if (endDate && !isIsoDate(endDate)) return 'Return date must be a valid date (YYYY-MM-DD).'
  if (endDate && endDate < travelDate) return 'Return date can’t be before the start date.'

  const tripType = params.tripType as Trip['tripType']
  if (!TRIP_TYPES.includes(tripType)) return 'Unknown trip type.'
  const travelMode = params.travelMode as Trip['travelMode']
  if (!TRAVEL_MODES.includes(travelMode)) return 'Unknown travel mode.'

  const travelers = Number(params.travelers)
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 50) {
    return 'Travelers must be a whole number from 1 to 50.'
  }

  const stops = Array.isArray(params.stops)
    ? params.stops.map((s) => text(s, 200)).filter(Boolean).slice(0, 10)
    : []
  const preferences = Array.isArray(params.preferences)
    ? params.preferences.filter((p): p is string => (TRIP_PREFERENCES as readonly unknown[]).includes(p))
    : []

  return {
    name,
    startLocation,
    destination,
    stops,
    travelDate,
    ...(endDate ? { endDate } : {}),
    tripType,
    travelMode,
    travelers,
    preferences,
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** Creates a trip and makes the caller its owner. Returns `{ tripId }`. */
const createTrip: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const parsed = parseTrip(params)
  if (typeof parsed === 'string') return { success: false, error: parsed }

  // The trip is its own team: tripId doubles as the record id and teamField.
  const tripId = crypto.randomUUID()
  const trip = await tools.create<Trip>('trips', { ...parsed, tripId }, tripId)
  if (!trip.success) return trip

  const membership = await tools.create<TeamMember>('team_members', {
    TeamId: tripId,
    UserId: userId,
    Role: 'owner',
    Status: 'active',
    InvitedBy: userId,
  })
  if (!membership.success) return membership

  return { success: true, data: { tripId } }
}

/**
 * Owner-only. Adds a signed-up user (looked up by email) to a trip as editor
 * or viewer, or changes their role if they are already a member.
 */
const shareTrip: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const tripId = text(params.tripId)
  const email = text(params.email, 320).toLowerCase()
  const role = params.role as TripRole
  if (!tripId || !email) return { success: false, error: 'Trip and email are required.' }
  if (role !== 'editor' && role !== 'viewer') {
    return { success: false, error: 'Role must be editor or viewer.' }
  }

  const access = await requireTripRole(tools, tripId, userId, 'owner')
  if (!access.success) return access

  // Server-side lookup: clients can't read other users' emails.
  const users = await tools.query<{ email?: string }>('users', { where: { email }, limit: 1 })
  if (!users.success) return users
  const invitee = users.data.records[0]
  if (!invitee) {
    return {
      success: false,
      error: 'No BeforeMiles user with that email. Ask them to sign in once, then try again.',
    }
  }
  if (invitee.recordId === userId) return { success: false, error: 'You already own this trip.' }

  const existing = await tools.query<TeamMember>('team_members', {
    where: { TeamId: tripId, UserId: invitee.recordId },
    limit: 1,
  })
  if (!existing.success) return existing
  const current = existing.data.records[0]

  if (current) {
    if (current.data.Role === 'owner') return { success: false, error: 'That user owns this trip.' }
    const updated = await tools.update<TeamMember>('team_members', current.recordId, { Role: role, Status: 'active' })
    if (!updated.success) return updated
  } else {
    const created = await tools.create<TeamMember>('team_members', {
      TeamId: tripId,
      UserId: invitee.recordId,
      Role: role,
      Status: 'active',
      InvitedBy: userId,
    })
    if (!created.success) return created
  }

  return { success: true, data: { userId: invitee.recordId, role } }
}

/** The caller's preferred AI style, if they saved one in Settings. */
async function aiStyleFor(tools: ActionTools, userId: string): Promise<AiStyle | undefined> {
  const prefs = await tools.get<UserPreferences>('user_preferences', userId)
  return prefs.success ? prefs.data.record.data.aiStyle : undefined
}

// Owner-billed model calls: one run per trip per cooldown window (reports and reviews each).
const REPORT_COOLDOWN_MS = 60_000

/** Whole days from today (UTC) to a YYYY-MM-DD date; null if unparseable. */
function daysUntil(isoDate: string): number | null {
  const target = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(target)) return null
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((target - today) / 86_400_000)
}

/**
 * Owner/editor. Generates the trip's readiness report and replaces its
 * AI-suggested checklist items and unsaved stop suggestions. The model call
 * runs before any write, so a failed generation leaves the old report intact.
 */
const generateReport: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const tripId = text(params.tripId)
  if (!tripId) return { success: false, error: 'Trip is required.' }

  const access = await requireTripRole(tools, tripId, userId, 'editor')
  if (!access.success) return access

  const trip = await tools.get<Trip>('trips', tripId)
  if (!trip.success) return trip

  const existing = await tools.get<Report>('reports', tripId)
  if (existing.success) {
    const age = Date.now() - Date.parse(existing.data.record.data.generatedAt)
    if (age < REPORT_COOLDOWN_MS) {
      return { success: false, error: 'A report was just generated. Try again in a minute.' }
    }
  }

  let result
  try {
    result = await generateReadiness(env, trip.data.record.data, await aiStyleFor(tools, userId))
  } catch (err) {
    console.error('[generateReport] model call failed', err)
    return { success: false, error: 'Could not generate the report. Please try again.' }
  }

  const { checklist, stops, ...content } = result
  const report = await tools.create<Report>(
    'reports',
    { tripId, content, model: READINESS_MODEL, generatedBy: userId, generatedAt: new Date().toISOString() },
    tripId, // one report per trip: creating with a known id upserts
  )
  if (!report.success) return report

  // Preserve progress: checked items and saved stops survive (see planRegeneration).
  const oldItems = await tools.query<ChecklistItem>('checklist_items', { where: { tripId }, limit: 500 })
  const oldStops = await tools.query<StopSuggestion>('stop_suggestions', { where: { tripId }, limit: 500 })
  if (!oldItems.success) return oldItems
  if (!oldStops.success) return oldStops
  const plan = planRegeneration(oldItems.data.records, oldStops.data.records, checklist, stops)

  await Promise.all([
    ...plan.removeItemIds.map((id) => tools.remove('checklist_items', id)),
    ...plan.removeStopIds.map((id) => tools.remove('stop_suggestions', id)),
  ])
  const writes = await Promise.all([
    ...plan.createItems.map((item, position) =>
      tools.create<ChecklistItem>('checklist_items', { tripId, ...item, checked: false, source: 'ai', position }),
    ),
    ...plan.createStops.map((stop, position) =>
      tools.create<StopSuggestion>('stop_suggestions', { tripId, ...stop, saved: false, position }),
    ),
  ])
  const failed = writes.find((w) => !w.success)
  if (failed) return failed

  return { success: true, data: { checklistCount: plan.createItems.length, stopCount: plan.createStops.length } }
}

/**
 * Loads a trip-scoped row by id and checks the caller's role on its trip.
 * Trip-scoped writes must authorize against the row's own tripId — never a
 * tripId taken from params, which a caller could point at a trip they edit.
 */
async function loadForTripWrite<T extends { tripId: string }>(
  tools: ActionTools,
  collection: string,
  recordId: unknown,
  userId: string,
): Promise<ActionResult<{ data: T }>> {
  if (typeof recordId !== 'string' || !recordId) return { success: false, error: 'Item is required.' }
  const row = await tools.get<T>(collection, recordId)
  if (!row.success) return { success: false, error: 'Item not found.' }
  const access = await requireTripRole(tools, row.data.record.data.tripId, userId, 'editor')
  if (!access.success) return access
  return { success: true, data: { data: row.data.record.data } }
}

/** Owner/editor. Checks or unchecks a checklist item, recording who and when. */
const setChecklistItemChecked: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const item = await loadForTripWrite<ChecklistItem>(tools, 'checklist_items', params.itemId, userId)
  if (!item.success) return item
  const checked = params.checked === true
  return tools.update<ChecklistItem>('checklist_items', params.itemId as string, {
    checked,
    checkedBy: checked ? userId : '',
    checkedAt: checked ? new Date().toISOString() : '',
  })
}

const MAX_ASSIGNEE_LENGTH = 60

/** Owner/editor. Adds a custom checklist item, optionally assigned to a traveler by name. */
const addManualChecklistItem: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const tripId = text(params.tripId)
  const itemText = text(params.text, 200)
  const category = (CHECKLIST_CATEGORIES as readonly unknown[]).includes(params.category)
    ? (params.category as ChecklistCategory)
    : 'planning'
  const assignedToName = text(params.assignedToName, MAX_ASSIGNEE_LENGTH)
  if (!tripId || !itemText) return { success: false, error: 'Item text is required.' }

  const access = await requireTripRole(tools, tripId, userId, 'editor')
  if (!access.success) return access

  // Manual items go after everything already on the list.
  const existing = await tools.query<ChecklistItem>('checklist_items', { where: { tripId }, limit: 500 })
  if (!existing.success) return existing
  const position = Math.max(-1, ...existing.data.records.map((r) => Number(r.data.position) || 0)) + 1

  const created = await tools.create<ChecklistItem>('checklist_items', {
    tripId,
    text: itemText,
    category,
    checked: false,
    source: 'manual',
    assignedToName,
    position,
  })
  if (!created.success) return created
  return { success: true, data: { itemId: created.data.recordId } }
}

/** Owner/editor. Sets or clears (empty string) who an item is assigned to. */
const updateChecklistItemAssignment: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const item = await loadForTripWrite<ChecklistItem>(tools, 'checklist_items', params.itemId, userId)
  if (!item.success) return item
  return tools.update<ChecklistItem>('checklist_items', params.itemId as string, {
    assignedToName: text(params.assignedToName, MAX_ASSIGNEE_LENGTH),
  })
}

/** Owner/editor. Saves or unsaves a stop suggestion, recording who and when. */
const setStopSaved: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const stop = await loadForTripWrite<StopSuggestion>(tools, 'stop_suggestions', params.stopId, userId)
  if (!stop.success) return stop
  const saved = params.saved === true
  return tools.update<StopSuggestion>('stop_suggestions', params.stopId as string, {
    saved,
    savedBy: saved ? userId : '',
    savedAt: saved ? new Date().toISOString() : '',
  })
}

/**
 * Owner/editor. Attaches a file the caller already uploaded to their private
 * storage. The key must sit in the caller's own folder for this trip
 * (apps/<app>/users/<caller>/trips/<tripId>/…): files are later read *as the
 * uploader*, so this keeps an editor from attaching anyone else's file.
 */
const addTripDocument: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const tripId = text(params.tripId)
  const fileKey = text(params.fileKey, 1024)
  const fileName = text(params.fileName, 200)
  const mimeType = text(params.mimeType, 120) || 'application/octet-stream'
  const size = Number(params.size)
  const documentType = (DOCUMENT_TYPES as readonly unknown[]).includes(params.documentType)
    ? (params.documentType as DocumentType)
    : 'other'
  if (!tripId || !fileKey || !fileName) return { success: false, error: 'Trip, file and name are required.' }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_DOCUMENT_BYTES) {
    return { success: false, error: 'Files must be 10 MB or smaller.' }
  }

  const access = await requireTripRole(tools, tripId, userId, 'editor')
  if (!access.success) return access

  const ownFolder = `apps/${env.DEEPSPACE_APP_ID}/users/${userId}/trips/${tripId}/`
  if (!fileKey.startsWith(ownFolder) || fileKey.includes('..')) {
    return { success: false, error: 'That file was not uploaded by you for this trip.' }
  }

  const created = await tools.create<TripDocument>('trip_documents', {
    tripId,
    fileKey,
    fileName,
    mimeType,
    size,
    documentType,
    uploadedBy: userId,
    uploadedAt: new Date().toISOString(),
  })
  if (!created.success) return created
  return { success: true, data: { documentId: created.data.recordId } }
}

/**
 * Owner/editor. "What am I missing?": reviews the trip's current state and
 * saves 3–5 prioritized suggestions (one review per trip, replaced each run).
 * The model call happens before the write, so a failure keeps the last review.
 */
const generateReadinessReview: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const tripId = text(params.tripId)
  if (!tripId) return { success: false, error: 'Trip is required.' }

  const access = await requireTripRole(tools, tripId, userId, 'editor')
  if (!access.success) return access

  const existing = await tools.get<ReadinessReview>('readiness_reviews', tripId)
  if (existing.success) {
    const age = Date.now() - Date.parse(existing.data.record.data.generatedAt)
    if (age < REPORT_COOLDOWN_MS) {
      return { success: false, error: 'A review was just run. Try again in a minute.' }
    }
  }

  const trip = await tools.get<Trip>('trips', tripId)
  if (!trip.success) return trip
  const report = await tools.get<Report>('reports', tripId) // absent is fine
  const [items, stops, documents] = await Promise.all([
    tools.query<ChecklistItem>('checklist_items', { where: { tripId }, limit: 500 }),
    tools.query<StopSuggestion>('stop_suggestions', { where: { tripId }, limit: 500 }),
    tools.query<TripDocument>('trip_documents', { where: { tripId }, limit: 100 }),
  ])
  if (!items.success) return items
  if (!stops.success) return stops
  if (!documents.success) return documents

  const itemRows = items.data.records.map((r) => r.data)
  const stopRows = stops.data.records.map((r) => r.data)
  const score = computeReadinessScore(itemRows, stopRows)?.score

  let suggestions
  try {
    suggestions = await reviewTripReadiness(env, {
      trip: trip.data.record.data,
      daysUntilTrip: daysUntil(trip.data.record.data.travelDate),
      report: report.success ? report.data.record.data.content : undefined,
      items: itemRows,
      stops: stopRows,
      // File names and types only — never file contents.
      documents: documents.data.records.map((r) => ({ fileName: r.data.fileName, documentType: r.data.documentType })),
      score,
    }, await aiStyleFor(tools, userId))
  } catch (err) {
    console.error('[generateReadinessReview] model call failed', err)
    return { success: false, error: 'Could not run the review. Please try again.' }
  }

  const saved = await tools.create<ReadinessReview>(
    'readiness_reviews',
    {
      tripId,
      suggestions,
      model: REVIEW_MODEL,
      generatedBy: userId,
      generatedAt: new Date().toISOString(),
      ...(score !== undefined ? { scoreAtReview: score } : {}),
    },
    tripId, // one review per trip: creating with a known id upserts
  )
  if (!saved.success) return saved
  return { success: true, data: { count: suggestions.length } }
}

// ── Itinerary ────────────────────────────────────────────────────────────────

/**
 * Owner/editor. Adds an item at the end of the trip's itinerary. With
 * `sourceStopId`, the item comes from a saved stop on the same trip and each
 * stop can be added once.
 */
const addItineraryItem: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const tripId = text(params.tripId)
  if (!tripId) return { success: false, error: 'Trip is required.' }
  const access = await requireTripRole(tools, tripId, userId, 'editor')
  if (!access.success) return access

  const trip = await tools.get<Trip>('trips', tripId)
  if (!trip.success) return trip
  const fields = parseItineraryFields(params, trip.data.record.data)
  if (typeof fields === 'string') return { success: false, error: fields }

  const existing = await tools.query<ItineraryItem>('itinerary_items', { where: { tripId }, limit: 500 })
  if (!existing.success) return existing

  const sourceStopId = text(params.sourceStopId)
  if (sourceStopId) {
    const stop = await tools.get<StopSuggestion>('stop_suggestions', sourceStopId)
    if (!stop.success || stop.data.record.data.tripId !== tripId) {
      return { success: false, error: 'That stop isn’t part of this trip.' }
    }
    if (existing.data.records.some((r) => r.data.sourceStopId === sourceStopId)) {
      return { success: false, error: 'That stop is already in the itinerary.' }
    }
  }

  const order = Math.max(-1, ...existing.data.records.map((r) => Number(r.data.order) || 0)) + 1
  const created = await tools.create<ItineraryItem>('itinerary_items', {
    tripId,
    ...fields,
    order,
    ...(sourceStopId ? { sourceStopId } : {}),
  })
  if (!created.success) return created
  return { success: true, data: { itemId: created.data.recordId } }
}

/** Owner/editor. Replaces an item's editable fields (title, location, notes, date, time, type). */
const updateItineraryItem: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const item = await loadForTripWrite<ItineraryItem>(tools, 'itinerary_items', params.itemId, userId)
  if (!item.success) return item
  const trip = await tools.get<Trip>('trips', item.data.data.tripId)
  if (!trip.success) return trip
  const fields = parseItineraryFields(params, trip.data.record.data)
  if (typeof fields === 'string') return { success: false, error: fields }
  return tools.update<ItineraryItem>('itinerary_items', params.itemId as string, fields)
}

/** Owner/editor. Moves an item one place up or down, renumbering the list. */
const moveItineraryItem: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const item = await loadForTripWrite<ItineraryItem>(tools, 'itinerary_items', params.itemId, userId)
  if (!item.success) return item
  const direction = params.direction === 'up' ? 'up' : 'down'
  const all = await tools.query<ItineraryItem>('itinerary_items', { where: { tripId: item.data.data.tripId }, limit: 500 })
  if (!all.success) return all

  const changes = planMove(
    all.data.records.map((r) => ({ recordId: r.recordId, order: Number(r.data.order) || 0, createdAt: r.createdAt })),
    params.itemId as string,
    direction,
  )
  const writes = await Promise.all(changes.map((c) => tools.update<ItineraryItem>('itinerary_items', c.recordId, { order: c.order })))
  const failed = writes.find((w) => !w.success)
  if (failed) return failed
  return { success: true, data: { moved: changes.length > 0 } }
}

/** Owner/editor. Removes an itinerary item (no files or other records depend on it). */
const removeItineraryItem: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const item = await loadForTripWrite<ItineraryItem>(tools, 'itinerary_items', params.itemId, userId)
  if (!item.success) return item
  return tools.remove('itinerary_items', params.itemId as string)
}

// ── User preferences ─────────────────────────────────────────────────────────

/** Any signed-in user. Saves their own trip defaults and AI style (one row per user). */
const saveUserPreferences: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const defaultTravelMode = params.defaultTravelMode as Trip['travelMode']
  if (!TRAVEL_MODES.includes(defaultTravelMode)) return { success: false, error: 'Unknown travel mode.' }
  const defaultTravelers = Number(params.defaultTravelers)
  if (!Number.isInteger(defaultTravelers) || defaultTravelers < 1 || defaultTravelers > 50) {
    return { success: false, error: 'Travelers must be a whole number from 1 to 50.' }
  }
  const aiStyle = params.aiStyle as AiStyle
  if (!AI_STYLES.includes(aiStyle)) return { success: false, error: 'Unknown AI style.' }
  const defaultPreferences = Array.isArray(params.defaultPreferences)
    ? params.defaultPreferences.filter((p): p is string => (TRIP_PREFERENCES as readonly unknown[]).includes(p))
    : []

  // Record id = userId: creating with a known id upserts the caller's own row.
  const saved = await tools.create<UserPreferences>(
    'user_preferences',
    { userId, defaultTravelMode, defaultTravelers, defaultPreferences, aiStyle },
    userId,
  )
  if (!saved.success) return saved
  return { success: true, data: { saved: true } }
}

// ── Deletes ──────────────────────────────────────────────────────────────────

/**
 * Owner only. Deletes a trip and everything attached to it, in an order that
 * is safe to interrupt and retry (see src/server/trip-deletion.ts).
 */
const deleteTrip: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const tripId = text(params.tripId)
  if (!tripId) return { success: false, error: 'Trip is required.' }
  return deleteTripAndData(tools, tripId, userId, (fileKey, uploadedBy) => deletePrivateFile(env, fileKey, uploadedBy))
}

/** Owner only. Removes an editor or viewer from a trip; the owner can't be removed. */
const removeTripMember: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const membershipId = text(params.membershipId)
  if (!membershipId) return { success: false, error: 'Member is required.' }
  const membership = await tools.get<TeamMember>('team_members', membershipId)
  if (!membership.success) return { success: false, error: 'Member not found.' }
  const { TeamId, UserId, Role } = membership.data.record.data

  const access = await requireTripRole(tools, TeamId, userId, 'owner')
  if (!access.success) return access
  if (Role === 'owner' || UserId === userId) {
    return { success: false, error: 'The trip owner can’t be removed.' }
  }
  // Deleting the membership re-syncs the removed user's live queries, so the trip disappears for them.
  return tools.remove('team_members', membershipId)
}

/** Owner/editor. Deletes a document: the private file, then its metadata. */
const deleteTripDocument: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const doc = await loadForTripWrite<TripDocument>(tools, 'trip_documents', params.documentId, userId)
  if (!doc.success) return doc
  // Keep the metadata if the file can't be deleted, so nothing is left orphaned and the user can retry.
  const fileDeleted = await deletePrivateFile(env, doc.data.data.fileKey, doc.data.data.uploadedBy).catch(() => false)
  if (!fileDeleted) return { success: false, error: 'Couldn’t delete the file right now. Please try again.' }
  return tools.remove('trip_documents', params.documentId as string)
}

/** Owner/editor. Deletes a checklist item that a member added (AI items are managed by regeneration). */
const deleteManualChecklistItem: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const item = await loadForTripWrite<ChecklistItem>(tools, 'checklist_items', params.itemId, userId)
  if (!item.success) return item
  if (item.data.data.source !== 'manual') {
    return { success: false, error: 'Only items added by your group can be deleted.' }
  }
  return tools.remove('checklist_items', params.itemId as string)
}

export const actions: Record<string, ActionHandler<Env>> = {
  createTrip,
  shareTrip,
  generateReport,
  setChecklistItemChecked,
  addManualChecklistItem,
  updateChecklistItemAssignment,
  setStopSaved,
  addTripDocument,
  generateReadinessReview,
  addItineraryItem,
  updateItineraryItem,
  moveItineraryItem,
  removeItineraryItem,
  saveUserPreferences,
  deleteTrip,
  removeTripMember,
  deleteTripDocument,
  deleteManualChecklistItem,
}
