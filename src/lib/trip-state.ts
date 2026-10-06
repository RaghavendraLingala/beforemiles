/**
 * A trip's current planning state as plain text, for the "What am I missing?"
 * review prompt. Pure (no worker imports) so it can be unit tested.
 */

import type { Trip } from '../schemas/trips-schema'
import type { ReadinessContent } from '../schemas/reports-schema'
import type { ChecklistItem } from '../schemas/checklist-items-schema'
import type { StopSuggestion } from '../schemas/stop-suggestions-schema'
import type { TripDocument } from '../schemas/trip-documents-schema'
import { tripLengthDays } from './format'

export type TripState = {
  trip: Trip
  daysUntilTrip: number | null
  report?: ReadinessContent
  items: ChecklistItem[]
  stops: StopSuggestion[]
  documents: Pick<TripDocument, 'fileName' | 'documentType'>[]
  score?: number
}

export function describeTripState(s: TripState): string {
  const { trip } = s
  const lines = [
    `Trip: ${trip.name}`,
    `Route: ${[trip.startLocation, ...(trip.stops ?? []), trip.destination].join(' → ')}`,
    `Travel date: ${trip.travelDate}${s.daysUntilTrip !== null ? ` (${s.daysUntilTrip} days from today)` : ''}`,
    ...(trip.endDate && trip.endDate !== trip.travelDate
      ? [`Return date: ${trip.endDate} (${tripLengthDays(trip.travelDate, trip.endDate)}-day trip)`]
      : []),
    `Trip type: ${trip.tripType}; travel mode: ${trip.travelMode}; travelers: ${trip.travelers}`,
    `Preferences: ${trip.preferences?.length ? trip.preferences.join(', ') : 'none'}`,
    `Readiness score: ${s.score !== undefined ? `${s.score}/100` : 'none yet (no checklist)'}`,
    '',
    s.report
      ? `Readiness report summary: ${s.report.summary}\nReport safety notes: ${s.report.safetyNotes.join('; ')}\nReport emergency prep: ${s.report.emergencyPreparedness.join('; ')}`
      : 'Readiness report: not generated yet.',
    '',
    `Checklist (${s.items.filter((i) => i.checked).length}/${s.items.length} done):`,
    ...(s.items.length
      ? s.items.map(
          (i) => `- [${i.checked ? 'x' : ' '}] (${i.category}${i.source === 'manual' ? ', manual' : ''}) ${i.text}${i.assignedToName ? ` — assigned to ${i.assignedToName}` : ''}`,
        )
      : ['- (empty)']),
    '',
    `Saved stops: ${s.stops.filter((x) => x.saved).map((x) => `${x.category}: ${x.title}`).join('; ') || 'none'}`,
    `Documents attached: ${s.documents.length ? s.documents.map((d) => `${d.documentType} (${d.fileName})`).join('; ') : 'none'}`,
  ]
  return lines.join('\n')
}

