/**
 * Readiness reports — one per trip (record id = tripId), replaced on
 * regenerate. The checklist and stop suggestions generated alongside it live
 * in their own collections so later phases can update them row by row.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'

/** The AI-written narrative sections, stored as one JSON column. */
export type ReadinessContent = {
  summary: string
  weatherPrep: string[]
  whatToCarry: string[]
  clothing: string[]
  emergencyPreparedness: string[]
  safetyNotes: string[]
}

export type Report = {
  tripId: string
  content: ReadinessContent
  model: string
  generatedBy: string
  generatedAt: string
}

export const reportsSchema: CollectionSchema = {
  name: 'reports',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'content', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'model', storage: 'text', interpretation: 'plain' },
    { name: 'generatedBy', storage: 'text', interpretation: 'plain' },
    { name: 'generatedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  uniqueOn: ['tripId'],
  teamField: 'tripId',
  permissions: tripTeamPermissions,
}
