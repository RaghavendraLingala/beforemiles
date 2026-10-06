/**
 * Useful stop suggestions for a trip. These are AI planning suggestions —
 * kinds of places worth looking for along the route — not verified listings.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'

export const STOP_CATEGORIES = [
  'restroom',
  'fuel/EV charging',
  'food',
  'rest area',
  'medical',
  'scenic',
  'lodging',
  'other',
] as const
export type StopCategory = (typeof STOP_CATEGORIES)[number]

export type StopSuggestion = {
  tripId: string
  category: StopCategory
  title: string
  reason: string
  saved: boolean
  savedBy?: string
  savedAt?: string
  position: number
}

export const stopSuggestionsSchema: CollectionSchema = {
  name: 'stop_suggestions',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'category', storage: 'text', interpretation: { kind: 'select', options: [...STOP_CATEGORIES] } },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'reason', storage: 'text', interpretation: 'plain' },
    { name: 'saved', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
    { name: 'savedBy', storage: 'text', interpretation: 'plain' },
    { name: 'savedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'position', storage: 'number', interpretation: 'plain' },
  ],
  teamField: 'tripId',
  permissions: tripTeamPermissions,
}
