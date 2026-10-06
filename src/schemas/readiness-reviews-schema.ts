/**
 * "What am I missing?" reviews — one per trip (record id = tripId), replaced
 * each time an owner/editor runs a new review. Read by every trip member.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'
import type { ChecklistCategory } from './checklist-items-schema'

export const REVIEW_PRIORITIES = ['high', 'medium', 'low'] as const
export type ReviewPriority = (typeof REVIEW_PRIORITIES)[number]

export type ReviewSuggestion = {
  priority: ReviewPriority
  title: string
  reason: string
  action: string
  /** Short task text used by "Add to checklist". */
  checklistItem: string
  category: ChecklistCategory
}

export type ReadinessReview = {
  tripId: string
  suggestions: ReviewSuggestion[]
  model: string
  generatedBy: string
  generatedAt: string
  scoreAtReview?: number
}

export const readinessReviewsSchema: CollectionSchema = {
  name: 'readiness_reviews',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'suggestions', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'model', storage: 'text', interpretation: 'plain' },
    { name: 'generatedBy', storage: 'text', interpretation: 'plain' },
    { name: 'generatedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'scoreAtReview', storage: 'number', interpretation: 'plain' },
  ],
  uniqueOn: ['tripId'],
  teamField: 'tripId',
  permissions: tripTeamPermissions,
}
