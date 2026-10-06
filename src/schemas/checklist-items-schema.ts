/**
 * Before-you-leave checklist items for a trip: AI-suggested (from the report)
 * or added manually by an owner/editor. `assignedToName` is free text
 * ("Sam", "Mom") — travelers needn't have accounts.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'

export const CHECKLIST_CATEGORIES = ['documents', 'packing', 'vehicle', 'health', 'safety', 'planning'] as const
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number]

export type ChecklistItem = {
  tripId: string
  text: string
  category: ChecklistCategory
  checked: boolean
  checkedBy?: string
  checkedAt?: string
  source: 'ai' | 'manual'
  assignedToName?: string
  position: number
}

export const checklistItemsSchema: CollectionSchema = {
  name: 'checklist_items',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'text', storage: 'text', interpretation: 'plain', required: true },
    { name: 'category', storage: 'text', interpretation: { kind: 'select', options: [...CHECKLIST_CATEGORIES] } },
    { name: 'checked', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
    { name: 'checkedBy', storage: 'text', interpretation: 'plain' },
    { name: 'checkedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'source', storage: 'text', interpretation: { kind: 'select', options: ['ai', 'manual'] } },
    { name: 'assignedToName', storage: 'text', interpretation: 'plain' },
    { name: 'position', storage: 'number', interpretation: 'plain' },
  ],
  teamField: 'tripId',
  permissions: tripTeamPermissions,
}
