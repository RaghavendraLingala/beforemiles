/**
 * Trip memberships — who can access which trip, and with what role.
 *
 * The collection name and the TeamId / UserId / Status column names are fixed
 * by the SDK: RecordRoom resolves `'team'` permissions with SQL against
 * `team_members.TeamId/UserId/Status`, and re-syncs a user's subscriptions
 * when a row with their `UserId` changes (that's what makes a newly shared
 * trip appear live). Hence the PascalCase here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'

export const TRIP_ROLES = ['owner', 'editor', 'viewer'] as const
export type TripRole = (typeof TRIP_ROLES)[number]

export type TeamMember = {
  TeamId: string // = tripId
  UserId: string
  Role: TripRole
  Status: 'active'
  InvitedBy: string
}

export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'TeamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'UserId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'Role', storage: 'text', interpretation: { kind: 'select', options: [...TRIP_ROLES] } },
    { name: 'Status', storage: 'text', interpretation: { kind: 'select', options: ['active'] } },
    { name: 'InvitedBy', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['TeamId', 'UserId'],
  teamField: 'TeamId',
  // Members of a trip can see each other; memberships change only via actions.
  permissions: tripTeamPermissions,
}
