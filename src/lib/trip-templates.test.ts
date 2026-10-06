import { describe, expect, it } from 'vitest'
import { TRAVEL_MODES, TRIP_PREFERENCES, TRIP_TYPES } from '../schemas/trips-schema'
import { TRIP_TEMPLATES } from './trip-templates'

describe('TRIP_TEMPLATES', () => {
  it('ships the six planned templates with unique ids', () => {
    expect(TRIP_TEMPLATES.map((t) => t.label)).toEqual([
      'Road trip',
      'Hiking trip',
      'Family trip',
      'City visit',
      'Business trip',
      'Airport travel',
    ])
    expect(new Set(TRIP_TEMPLATES.map((t) => t.id)).size).toBe(TRIP_TEMPLATES.length)
  })

  // The server rejects unknown values, so a template must only use schema options.
  it.each(TRIP_TEMPLATES)('$label only uses values createTrip accepts', (t) => {
    expect(TRIP_TYPES).toContain(t.tripType)
    expect(TRAVEL_MODES).toContain(t.travelMode)
    for (const p of t.preferences) expect(TRIP_PREFERENCES).toContain(p)
  })
})
