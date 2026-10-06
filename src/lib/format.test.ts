import { describe, expect, it } from 'vitest'
import { formatTripDate, formatTripDateRange, isIsoDate, tripLengthDays } from './format'

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-11-01')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true) // leap year
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-02-31')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('11/01/2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('tripLengthDays', () => {
  it('counts both ends; no or same end date is a one-day trip', () => {
    expect(tripLengthDays('2026-11-01')).toBe(1)
    expect(tripLengthDays('2026-11-01', '2026-11-01')).toBe(1)
    expect(tripLengthDays('2026-11-01', '2026-11-03')).toBe(3)
    expect(tripLengthDays('2026-12-31', '2027-01-02')).toBe(3)
  })
})

describe('formatTripDateRange', () => {
  it('shows a single date when there is no distinct end date', () => {
    expect(formatTripDateRange('2026-11-01')).toBe(formatTripDate('2026-11-01'))
    expect(formatTripDateRange('2026-11-01', '2026-11-01')).toBe(formatTripDate('2026-11-01'))
  })

  it('shows a range, with the year once when both dates share it', () => {
    const range = formatTripDateRange('2026-11-01', '2026-11-03')
    expect(range).toContain(' – ')
    expect(range.match(/2026/g)).toHaveLength(1)
    expect(range.endsWith(formatTripDate('2026-11-03'))).toBe(true)
  })

  it('shows both years for a range across new year', () => {
    const range = formatTripDateRange('2026-12-31', '2027-01-02')
    expect(range).toContain('2026')
    expect(range).toContain('2027')
  })
})
