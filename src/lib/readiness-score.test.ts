import { describe, expect, it } from 'vitest'
import { computeReadinessScore } from './readiness-score'

const items = (checked: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({ checked: i < checked }))
const stops = (saved: number, total = 6) => Array.from({ length: total }, (_, i) => ({ saved: i < saved }))

describe('computeReadinessScore', () => {
  it('has no score before a checklist exists', () => {
    expect(computeReadinessScore([], stops(3))).toBeNull()
  })

  it('starts at 0 with nothing done', () => {
    expect(computeReadinessScore(items(0, 10), stops(0))?.score).toBe(0)
  })

  it('weights the checklist at 80 and saved stops at 20', () => {
    expect(computeReadinessScore(items(5, 10), stops(0))).toMatchObject({ score: 40, checklistPoints: 40, stopPoints: 0 })
    expect(computeReadinessScore(items(0, 10), stops(1))).toMatchObject({ score: 7, stopPoints: 7 })
  })

  it('caps stop points at three saved stops', () => {
    expect(computeReadinessScore(items(10, 10), stops(3))?.score).toBe(100)
    expect(computeReadinessScore(items(10, 10), stops(6))?.score).toBe(100)
  })
})
