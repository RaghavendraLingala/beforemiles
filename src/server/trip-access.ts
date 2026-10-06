/**
 * Trip role checks shared by every server action. Dependency-light (types
 * only) so deletion logic that uses it can be unit tested.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { TeamMember, TripRole } from '../schemas/team-members-schema'

const ROLE_RANK: Record<TripRole, number> = { viewer: 1, editor: 2, owner: 3 }

/**
 * Resolves the caller's active membership on a trip and fails unless their
 * role is at least `minRole` (owner > editor > viewer).
 */
export async function requireTripRole(
  tools: ActionTools,
  tripId: string,
  userId: string,
  minRole: TripRole,
): Promise<ActionResult<{ role: TripRole; membershipId: string }>> {
  const res = await tools.query<TeamMember>('team_members', {
    where: { TeamId: tripId, UserId: userId, Status: 'active' },
    limit: 1,
  })
  if (!res.success) return res
  const membership = res.data.records[0]
  if (!membership || ROLE_RANK[membership.data.Role] < ROLE_RANK[minRole]) {
    return { success: false, error: 'You do not have permission to do that on this trip.' }
  }
  return { success: true, data: { role: membership.data.Role, membershipId: membership.recordId } }
}
