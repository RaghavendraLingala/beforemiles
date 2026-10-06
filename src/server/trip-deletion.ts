/**
 * Deleting a trip, written to be safe to interrupt and retry.
 *
 * Order matters:
 *   1. Owner check — on every call, including retries. Nothing is skipped
 *      because a record is already missing.
 *   2. Documents, one at a time: delete the private file, then its metadata.
 *      If a file can't be deleted, its metadata row is KEPT (it holds the key
 *      and uploader needed to retry) and the trip deletion stops before
 *      touching anything else. Files already gone (404) count as deleted.
 *   3. Remaining child records (checklist, stops, itinerary, report, review).
 *   4. The trip record — skipped if a previous attempt already removed it.
 *   5. Other members' memberships, then the owner's membership LAST, so an
 *      interruption anywhere earlier still leaves the owner authorized to retry.
 *
 * Every step is idempotent, so calling it again after any failure resumes
 * where the last attempt stopped.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { TeamMember } from '../schemas/team-members-schema'
import type { TripDocument } from '../schemas/trip-documents-schema'
import { requireTripRole } from './trip-access'

/** Deletes one private file as its uploader; true when it is gone (including already missing). */
export type DeleteFile = (fileKey: string, uploadedBy: string) => Promise<boolean>

const CHILD_COLLECTIONS = ['checklist_items', 'stop_suggestions', 'itinerary_items', 'reports', 'readiness_reviews'] as const

/** Deletes every row matching `where`, one bounded page at a time. */
export async function drain(tools: ActionTools, collection: string, where: Record<string, unknown>): Promise<ActionResult<{ deleted: number }>> {
  const PAGE = 500
  let total = 0
  for (;;) {
    const page = await tools.deleteWhere(collection, where, PAGE)
    if (!page.success) return page
    total += page.data.deleted
    if (page.data.deleted < PAGE) return { success: true, data: { deleted: total } }
  }
}

export async function deleteTripAndData(
  tools: ActionTools,
  tripId: string,
  userId: string,
  deleteFile: DeleteFile,
): Promise<ActionResult<{ deleted: true }>> {
  const access = await requireTripRole(tools, tripId, userId, 'owner')
  if (!access.success) return access

  // 2. Documents: file first, then metadata; keep metadata for any file that fails.
  const documents = await tools.query<TripDocument>('trip_documents', { where: { tripId }, limit: 500 })
  if (!documents.success) return documents
  let filesNotDeleted = 0
  for (const doc of documents.data.records) {
    const fileGone = await deleteFile(doc.data.fileKey, doc.data.uploadedBy).catch(() => false)
    if (!fileGone) {
      filesNotDeleted++
      continue
    }
    const removed = await tools.remove('trip_documents', doc.recordId)
    if (!removed.success) return removed
  }
  if (filesNotDeleted) {
    console.warn(`[deleteTrip] ${filesNotDeleted} file(s) not deleted; trip kept so the deletion can be retried`)
    return {
      success: false,
      error: `Couldn’t delete ${filesNotDeleted} document file(s) right now, so the trip wasn’t deleted. Please try again.`,
    }
  }

  // 3. Everything else that belongs to the trip.
  for (const collection of CHILD_COLLECTIONS) {
    const cleared = await drain(tools, collection, { tripId })
    if (!cleared.success) return cleared
  }

  // 4. The trip itself — may already be gone if an earlier attempt got this far.
  const trip = await tools.get('trips', tripId)
  if (trip.success) {
    const removed = await tools.remove('trips', tripId)
    if (!removed.success) return removed
  }

  // 5. Memberships: everyone else first, the owner's own row last.
  const members = await tools.query<TeamMember>('team_members', { where: { TeamId: tripId }, limit: 500 })
  if (!members.success) return members
  const ownerRowId = access.data.membershipId
  for (const m of members.data.records) {
    if (m.recordId === ownerRowId) continue
    const removed = await tools.remove('team_members', m.recordId)
    if (!removed.success) return removed
  }
  const ownerRemoved = await tools.remove('team_members', ownerRowId)
  if (!ownerRemoved.success) return ownerRemoved

  return { success: true, data: { deleted: true } }
}
