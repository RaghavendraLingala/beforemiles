/**
 * Itinerary items — a trip's ordered timeline (start, stops, meals, fuel,
 * activities, arrival). Order is manual (`order`, moved with up/down);
 * date and time are optional labels shown on each item.
 *
 * Who created an item and when come from the record envelope
 * (`record.createdBy`, `record.createdAt`), set by the server.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'

export const ITINERARY_ITEM_TYPES = [
  'start',
  'stop',
  'food',
  'fuel',
  'emergency',
  'activity',
  'destination',
  'custom',
] as const
export type ItineraryItemType = (typeof ITINERARY_ITEM_TYPES)[number]

export type ItineraryItem = {
  tripId: string
  title: string
  location?: string
  notes?: string
  /** YYYY-MM-DD, within the trip's dates. */
  plannedDate?: string
  /** HH:MM, 24-hour. */
  plannedTime?: string
  itemType: ItineraryItemType
  order: number
  /** Set when the item was added from a saved stop. */
  sourceStopId?: string
}

export const itineraryItemsSchema: CollectionSchema = {
  name: 'itinerary_items',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'location', storage: 'text', interpretation: 'plain' },
    { name: 'notes', storage: 'text', interpretation: 'plain' },
    { name: 'plannedDate', storage: 'text', interpretation: { kind: 'date' } },
    { name: 'plannedTime', storage: 'text', interpretation: 'plain' },
    { name: 'itemType', storage: 'text', interpretation: { kind: 'select', options: [...ITINERARY_ITEM_TYPES] } },
    { name: 'order', storage: 'number', interpretation: 'plain' },
    { name: 'sourceStopId', storage: 'text', interpretation: 'plain', immutable: true },
  ],
  teamField: 'tripId',
  permissions: tripTeamPermissions,
}
