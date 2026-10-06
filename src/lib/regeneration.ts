/**
 * What a report regeneration does to a trip's existing checklist and stops.
 *
 * Progress is preserved: checked items, assigned items, manual items, and
 * saved stops are kept untouched, assignments included. Unchecked, unassigned
 * AI items and unsaved stops are replaced by the new suggestions, except where
 * a new suggestion duplicates something kept — matched case- and
 * punctuation-insensitively, so the same task isn't listed twice. Pure: generateReport applies the plan with action tools.
 */

type Row<T> = { recordId: string; data: T }
type OldItem = { text: string; checked?: boolean; source?: string; assignedToName?: string }
type OldStop = { title: string; saved?: boolean }

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function planRegeneration<NewItem extends { text: string }, NewStop extends { title: string }>(
  oldItems: Row<OldItem>[],
  oldStops: Row<OldStop>[],
  newItems: NewItem[],
  newStops: NewStop[],
) {
  const keepItem = (r: Row<OldItem>) => !!r.data.checked || r.data.source !== 'ai' || !!r.data.assignedToName
  const keepStop = (r: Row<OldStop>) => !!r.data.saved
  const keptItemKeys = new Set(oldItems.filter(keepItem).map((r) => normalize(r.data.text)))
  const keptStopKeys = new Set(oldStops.filter(keepStop).map((r) => normalize(r.data.title)))

  return {
    removeItemIds: oldItems.filter((r) => !keepItem(r)).map((r) => r.recordId),
    removeStopIds: oldStops.filter((r) => !keepStop(r)).map((r) => r.recordId),
    createItems: newItems.filter((i) => !keptItemKeys.has(normalize(i.text))),
    createStops: newStops.filter((s) => !keptStopKeys.has(normalize(s.title))),
  }
}
