import { describe, expect, it } from 'vitest'
import { itemTypeForStop, parseItineraryFields, planMove, sortItinerary, tripDayNumber } from './itinerary'

const multiDay = { travelDate: '2026-11-01', endDate: '2026-11-03' }
const openEnded = { travelDate: '2026-11-01' }

describe('parseItineraryFields', () => {
  it('requires a title and defaults an unknown type to custom', () => {
    expect(parseItineraryFields({ title: '  ' }, multiDay)).toBe('Title is required.')
    expect(parseItineraryFields({ title: 'Lunch', itemType: 'party' }, multiDay)).toMatchObject({ itemType: 'custom' })
  })

  it('keeps planned dates within a multi-day trip', () => {
    expect(parseItineraryFields({ title: 'x', plannedDate: '2026-11-02' }, multiDay)).toMatchObject({ plannedDate: '2026-11-02' })
    expect(parseItineraryFields({ title: 'x', plannedDate: '2026-10-31' }, multiDay)).toMatch(/before the trip starts/)
    expect(parseItineraryFields({ title: 'x', plannedDate: '2026-11-04' }, multiDay)).toMatch(/after the trip ends/)
    expect(parseItineraryFields({ title: 'x', plannedDate: '2026-02-31' }, multiDay)).toMatch(/valid date/)
  })

  it('only bounds the start for trips without a return date', () => {
    expect(parseItineraryFields({ title: 'x', plannedDate: '2026-11-05' }, openEnded)).toMatchObject({ plannedDate: '2026-11-05' })
    expect(parseItineraryFields({ title: 'x', plannedDate: '2026-10-30' }, openEnded)).toMatch(/before the trip starts/)
  })

  it('accepts 24-hour HH:MM times only', () => {
    expect(parseItineraryFields({ title: 'x', plannedTime: '08:30' }, multiDay)).toMatchObject({ plannedTime: '08:30' })
    expect(parseItineraryFields({ title: 'x', plannedTime: '24:00' }, multiDay)).toMatch(/HH:MM/)
    expect(parseItineraryFields({ title: 'x', plannedTime: '8am' }, multiDay)).toMatch(/HH:MM/)
  })
})

describe('ordering', () => {
  const items = [
    { recordId: 'a', order: 0, createdAt: '1' },
    { recordId: 'b', order: 1, createdAt: '2' },
    { recordId: 'c', order: 2, createdAt: '3' },
  ]

  it('swaps neighbours and only returns changed orders', () => {
    expect(planMove(items, 'c', 'up')).toEqual([
      { recordId: 'c', order: 1 },
      { recordId: 'b', order: 2 },
    ])
    expect(planMove(items, 'a', 'up')).toEqual([])
    expect(planMove(items, 'c', 'down')).toEqual([])
  })

  it('heals duplicate orders while moving', () => {
    const dupes = [
      { recordId: 'a', order: 0, createdAt: '1' },
      { recordId: 'b', order: 0, createdAt: '2' },
      { recordId: 'c', order: 0, createdAt: '3' },
    ]
    expect(sortItinerary(dupes).map((i) => i.recordId)).toEqual(['a', 'b', 'c'])
    // New order b, a, c → b already has order 0, so only a and c change.
    expect(planMove(dupes, 'a', 'down')).toEqual([
      { recordId: 'a', order: 1 },
      { recordId: 'c', order: 2 },
    ])
  })
})

describe('helpers', () => {
  it('numbers trip days and maps stop categories', () => {
    expect(tripDayNumber('2026-11-01', '2026-11-03')).toBe(3)
    expect(tripDayNumber('2026-11-01')).toBeNull()
    expect(itemTypeForStop('fuel/EV charging')).toBe('fuel')
    expect(itemTypeForStop('medical')).toBe('emergency')
    expect(itemTypeForStop('rest area')).toBe('stop')
  })
})
