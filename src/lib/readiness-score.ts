/**
 * Readiness score — deterministic, computed from what the trip's members have
 * actually done, never from the AI.
 *
 *   score = 80 × (checked items / total items)
 *         + 20 × min(saved stops, 3) / 3
 *
 * The checklist carries most of the weight because it is the concrete prep
 * work. Saving a few useful stops shows the route has been thought through;
 * three saved stops earns the full 20 points. No checklist yet → no score.
 */

export const CHECKLIST_POINTS = 80
export const STOP_POINTS = 20
export const STOPS_FOR_FULL_POINTS = 3

export type ReadinessScore = {
  score: number
  checked: number
  total: number
  savedStops: number
  checklistPoints: number
  stopPoints: number
}

export function computeReadinessScore(
  items: { checked?: boolean }[],
  stops: { saved?: boolean }[],
): ReadinessScore | null {
  const total = items.length
  if (total === 0) return null

  const checked = items.filter((i) => i.checked).length
  const savedStops = stops.filter((s) => s.saved).length
  const checklistPoints = Math.round((CHECKLIST_POINTS * checked) / total)
  const stopPoints = Math.round((STOP_POINTS * Math.min(savedStops, STOPS_FOR_FULL_POINTS)) / STOPS_FOR_FULL_POINTS)

  return { score: checklistPoints + stopPoints, checked, total, savedStops, checklistPoints, stopPoints }
}
