/**
 * Trip date helpers. Dates are stored as calendar dates ("2026-11-01") and
 * always handled as local calendar days, so they never shift across time zones.
 */

/** True for a real calendar date in YYYY-MM-DD form ("2026-02-31" is false). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function toLocalDate(isoDate: string): Date | null {
  const [y, m, d] = isoDate.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

/** "2026-11-01" → "Sun, Nov 1, 2026". */
export function formatTripDate(isoDate: string): string {
  const date = toLocalDate(isoDate)
  if (!date) return isoDate
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** Number of calendar days a trip covers, counting both ends (a day trip is 1). */
export function tripLengthDays(start: string, end?: string): number {
  if (!end || end <= start) return 1
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
}

/**
 * One date for a one-day trip, otherwise a range:
 *   "Sun, Nov 1, 2026"
 *   "Sun, Nov 1 – Tue, Nov 3, 2026"            (same year)
 *   "Thu, Dec 31, 2026 – Sat, Jan 2, 2027"     (across years)
 */
export function formatTripDateRange(start: string, end?: string): string {
  if (!end || end === start) return formatTripDate(start)
  const from = toLocalDate(start)
  const to = toLocalDate(end)
  if (!from || !to) return `${start} – ${end}`
  const sameYear = from.getFullYear() === to.getFullYear()
  const fromText = from.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `${fromText} – ${formatTripDate(end)}`
}
