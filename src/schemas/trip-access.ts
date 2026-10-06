import type { RolePermissions } from 'deepspace/schema'

/**
 * Shared access rule for every trip-scoped collection.
 *
 * Reads use the SDK's `'team'` level with `teamField: 'tripId'` (or `TeamId`
 * on team_members): the RecordRoom only ships a row to its creator or to users
 * with an active `team_members` row for that trip. Nobody writes from the
 * client — every write goes through a server action in src/actions/index.ts
 * that checks the caller's owner/editor/viewer role first.
 */
const teamReadOnly: RolePermissions = { read: 'team', create: false, update: false, delete: false }

export const tripTeamPermissions: Record<string, RolePermissions> = {
  viewer: teamReadOnly,
  member: teamReadOnly,
  admin: teamReadOnly,
}
