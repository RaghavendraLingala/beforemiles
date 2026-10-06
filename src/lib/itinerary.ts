/**
 * Pure itinerary rules shared by the server actions and the UI: field
 * validation, the planned-date window, and reordering.
 */

import { ITINERARY_ITEM_TYPES, type ItineraryItemType } from '../schemas/itinerary-items-schema'
import type { StopCategory } from '../schemas/stop-suggestions-schema'
import { isIsoDate } from './format'

export type ItineraryFields = {
  title: string
  location: string
  notes: string
  plannedDate: string
  plannedTime: string
  itemType: ItineraryItemType
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Validates submitted itinerary fields against the trip's dates.
 * With a return date, a planned date must fall within the trip; without one
 * (one-day or open-ended trips) it must be on or after the start date.
 */
export function parseItineraryFields(
  params: Record<string, unknown>,
  trip: { travelDate: string; endDate?: string },
): ItineraryFields | string {
  const title = text(params.title, 120)
  if (!title) return 'Title is required.'
  const itemType = (ITINERARY_ITEM_TYPES as readonly unknown[]).includes(params.itemType)
    ? (params.itemType as ItineraryItemType)
    : 'custom'

  const plannedDate = text(params.plannedDate, 10)
  if (plannedDate) {
    if (!isIsoDate(plannedDate)) return 'Planned date must be a valid date.'
    if (plannedDate < trip.travelDate) return 'Planned date can’t be before the trip starts.'
    if (trip.endDate && plannedDate > trip.endDate) return 'Planned date can’t be after the trip ends.'
  }
  const plannedTime = text(params.plannedTime, 5)
  if (plannedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(plannedTime)) {
    return 'Planned time must be HH:MM (24-hour).'
  }

  return {
    title,
    location: text(params.location, 200),
    notes: text(params.notes, 1000),
    plannedDate,
    plannedTime,
    itemType,
  }
}

/** Day number within the trip ("Day 2"), or null without a date. */
export function tripDayNumber(tripStart: string, plannedDate?: string): number | null {
  if (!plannedDate) return null
  return Math.round((Date.parse(`${plannedDate}T00:00:00Z`) - Date.parse(`${tripStart}T00:00:00Z`)) / 86_400_000) + 1
}

type Ordered = { recordId: string; order: number; createdAt: string }

/** Stable display order: `order`, then creation time for any ties. */
export function sortItinerary<T extends Ordered>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

/**
 * Moves one item up or down and renumbers the whole list 0..n-1, returning
 * only the items whose `order` must change. Renumbering heals any duplicate
 * orders left by concurrent edits.
 */
export function planMove(items: Ordered[], itemId: string, direction: 'up' | 'down'): { recordId: string; order: number }[] {
  const list = sortItinerary(items)
  const from = list.findIndex((i) => i.recordId === itemId)
  const to = direction === 'up' ? from - 1 : from + 1
  if (from < 0 || to < 0 || to >= list.length) return []
  ;[list[from], list[to]] = [list[to], list[from]]
  return list.map((item, index) => ({ item, index })).filter(({ item, index }) => item.order !== index)
    .map(({ item, index }) => ({ recordId: item.recordId, order: index }))
}

/** Itinerary type for a saved stop. */
export function itemTypeForStop(category: StopCategory): ItineraryItemType {
  if (category === 'food') return 'food'
  if (category === 'fuel/EV charging') return 'fuel'
  if (category === 'medical') return 'emergency'
  if (category === 'scenic') return 'activity'
  return 'stop'
}
