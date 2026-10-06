/**
 * Per-user preferences — one row per user (record id = userId), readable only
 * by that user. Written through the `saveUserPreferences` action, which
 * validates every value. Used to prefill the New trip form and to set the
 * style of AI reports and reviews the user generates.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { TRAVEL_MODES, type TravelMode } from './trips-schema'

export const AI_STYLES = ['concise', 'detailed', 'safety-focused'] as const
export type AiStyle = (typeof AI_STYLES)[number]

export type UserPreferences = {
  userId: string
  defaultTravelMode: TravelMode
  defaultTravelers: number
  defaultPreferences: string[]
  aiStyle: AiStyle
}

export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'userId'> = {
  defaultTravelMode: 'car',
  defaultTravelers: 1,
  defaultPreferences: [],
  aiStyle: 'concise',
}

const ownReadOnly: RolePermissions = { read: 'own', create: false, update: false, delete: false }

export const userPreferencesSchema: CollectionSchema = {
  name: 'user_preferences',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true, userBound: true },
    { name: 'defaultTravelMode', storage: 'text', interpretation: { kind: 'select', options: [...TRAVEL_MODES] } },
    { name: 'defaultTravelers', storage: 'number', interpretation: 'plain' },
    { name: 'defaultPreferences', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'aiStyle', storage: 'text', interpretation: { kind: 'select', options: [...AI_STYLES] } },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId'],
  permissions: { viewer: ownReadOnly, member: ownReadOnly, admin: ownReadOnly },
}
