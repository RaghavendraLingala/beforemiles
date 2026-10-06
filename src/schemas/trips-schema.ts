/**
 * Trips — one row per planned trip.
 *
 * Access model: reads use the SDK's `'team'` level. A trip is its own "team":
 * `tripId` (equal to the record id) is the teamField, and membership lives in
 * the `team_members` collection. The DO only ships a trip to users who
 * created it or hold an active membership row for it.
 *
 * Clients cannot write directly — every write goes through a server action in
 * src/actions/index.ts, which checks the caller's owner/editor/viewer role.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'

export const TRIP_TYPES = ['leisure', 'business', 'family', 'adventure', 'study', 'other'] as const
export const TRAVEL_MODES = ['car', 'ev', 'train', 'bus', 'flight', 'walking', 'bike'] as const
export const TRIP_PREFERENCES = [
  'restrooms',
  'emergency centers',
  'fuel/EV charging',
  'family-friendly',
  'hiking/walking',
  'budget-friendly',
] as const

export type TripType = (typeof TRIP_TYPES)[number]
export type TravelMode = (typeof TRAVEL_MODES)[number]

export type Trip = {
  tripId: string
  name: string
  startLocation: string
  destination: string
  stops: string[]
  /** Start date (YYYY-MM-DD). Kept as `travelDate` so existing trips keep working. */
  travelDate: string
  /** Optional return/end date, same day or after travelDate. Absent on one-day and older trips. */
  endDate?: string
  tripType: TripType
  travelMode: TravelMode
  travelers: number
  preferences: string[]
}

export const tripsSchema: CollectionSchema = {
  name: 'trips',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'startLocation', storage: 'text', interpretation: 'plain', required: true },
    { name: 'destination', storage: 'text', interpretation: 'plain', required: true },
    { name: 'stops', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'travelDate', storage: 'text', interpretation: { kind: 'date' } },
    { name: 'endDate', storage: 'text', interpretation: { kind: 'date' } },
    { name: 'tripType', storage: 'text', interpretation: { kind: 'select', options: [...TRIP_TYPES] } },
    { name: 'travelMode', storage: 'text', interpretation: { kind: 'select', options: [...TRAVEL_MODES] } },
    { name: 'travelers', storage: 'number', interpretation: 'plain' },
    { name: 'preferences', storage: 'text', interpretation: { kind: 'json' } },
  ],
  teamField: 'tripId',
  permissions: tripTeamPermissions,
}
