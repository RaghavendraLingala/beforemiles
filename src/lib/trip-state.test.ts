import { describe, expect, it } from 'vitest'
import { describeTripState, type TripState } from './trip-state'

const base: TripState = {
  trip: {
    tripId: 't1',
    name: 'Tahoe weekend',
    startLocation: 'Oakland, CA',
    destination: 'Lake Tahoe, CA',
    stops: ['Sacramento'],
    travelDate: '2026-12-01',
    tripType: 'family',
    travelMode: 'ev',
    travelers: 4,
    preferences: ['fuel/EV charging', 'family-friendly'],
  },
  daysUntilTrip: 12,
  items: [],
  stops: [],
  documents: [],
}

describe('describeTripState', () => {
  it('describes a bare trip with no report, checklist, stops, or documents', () => {
    const text = describeTripState(base)
    expect(text).toContain('Route: Oakland, CA → Sacramento → Lake Tahoe, CA')
    expect(text).toContain('Travel date: 2026-12-01 (12 days from today)')
    expect(text).toContain('Trip type: family; travel mode: ev; travelers: 4')
    expect(text).toContain('Preferences: fuel/EV charging, family-friendly')
    expect(text).toContain('Readiness score: none yet (no checklist)')
    expect(text).toContain('Readiness report: not generated yet.')
    expect(text).toContain('- (empty)')
    expect(text).toContain('Saved stops: none')
    expect(text).toContain('Documents attached: none')
  })

  it('includes progress, manual items, assignees, saved stops, and document types', () => {
    const text = describeTripState({
      ...base,
      score: 47,
      items: [
        { tripId: 't1', text: 'Charge the car', category: 'vehicle', checked: true, source: 'ai', position: 0 },
        { tripId: 't1', text: 'Pack snow chains', category: 'vehicle', checked: false, source: 'manual', position: 1, assignedToName: 'Sam' },
      ],
      stops: [
        { tripId: 't1', category: 'fuel/EV charging', title: 'Fast charger near Auburn', reason: '', saved: true, position: 0 },
        { tripId: 't1', category: 'food', title: 'Diner', reason: '', saved: false, position: 1 },
      ],
      documents: [{ fileName: 'cabin.pdf', documentType: 'booking' }],
    })
    expect(text).toContain('Readiness score: 47/100')
    expect(text).toContain('Checklist (1/2 done):')
    expect(text).toContain('- [x] (vehicle) Charge the car')
    expect(text).toContain('- [ ] (vehicle, manual) Pack snow chains — assigned to Sam')
    expect(text).toContain('Saved stops: fuel/EV charging: Fast charger near Auburn')
    expect(text).not.toContain('Diner')
    expect(text).toContain('Documents attached: booking (cabin.pdf)')
  })

  it('mentions the return date and trip length only for multi-day trips', () => {
    expect(describeTripState(base)).not.toContain('Return date')
    const text = describeTripState({ ...base, trip: { ...base.trip, endDate: '2026-12-04' } })
    expect(text).toContain('Return date: 2026-12-04 (4-day trip)')
  })
})
