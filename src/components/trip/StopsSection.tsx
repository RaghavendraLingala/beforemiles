import { useState } from 'react'
import { useQuery, useUserLookup } from 'deepspace'
import { Bookmark, BookmarkCheck, CalendarCheck, CalendarPlus, MapPin } from 'lucide-react'
import { Badge, Button, EmptyState, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { formatWhen, usePendingToggles } from '@/lib/use-pending'
import { itemTypeForStop } from '@/lib/itinerary'
import type { StopSuggestion } from '../../schemas/stop-suggestions-schema'
import type { ItineraryItem } from '../../schemas/itinerary-items-schema'

export function StopsSection({ tripId, canEdit, onOpenReport }: {
  tripId: string
  canEdit: boolean
  onOpenReport: () => void
}) {
  const { records: stops } = useQuery<StopSuggestion>('stop_suggestions', { where: { tripId }, orderBy: 'position' })
  const { getUser } = useUserLookup()
  const { error } = useToast()
  const { isPending, valueFor, run } = usePendingToggles()
  const { records: itinerary } = useQuery<ItineraryItem>('itinerary_items', { where: { tripId } })
  const inItinerary = new Set(itinerary.map((i) => i.data.sourceStopId).filter(Boolean))
  const [addingStopId, setAddingStopId] = useState<string | null>(null)
  if (stops.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card">
        <EmptyState
          icon={<MapPin />}
          title="No stop suggestions yet"
          description="Useful stops are suggested with the Trip Readiness Report."
          action={{ label: 'Go to Report', onClick: onOpenReport }}
        />
      </section>
    )
  }

  const rows = stops.map((s) => ({ ...s, isSaved: valueFor(s.recordId, !!s.data.saved) }))
  const saved = rows.filter((s) => s.isSaved)
  const suggestions = rows.filter((s) => !s.isSaved)

  async function setSaved(stopId: string, value: boolean) {
    const result = await run(stopId, value, () => callAction('setStopSaved', { stopId, saved: value }))
    if (!result.success) error('Could not update stop', result.error)
  }

  async function addToItinerary(stopId: string, stop: StopSuggestion) {
    setAddingStopId(stopId)
    const result = await callAction('addItineraryItem', {
      tripId,
      title: stop.title,
      itemType: itemTypeForStop(stop.category),
      notes: stop.reason,
      sourceStopId: stopId,
    })
    setAddingStopId(null)
    if (!result.success) error('Could not add to itinerary', result.error)
  }

  const renderStop = ({ recordId, data, isSaved }: (typeof rows)[number]) => (
    <StopCard
      key={recordId}
      recordId={recordId}
      stop={data}
      isSaved={isSaved}
      canEdit={canEdit}
      disabled={isPending(recordId)}
      savedByName={data.savedBy ? (getUser(data.savedBy)?.name ?? 'a member') : undefined}
      onToggle={() => setSaved(recordId, !isSaved)}
      itinerary={
        isSaved && data.saved && canEdit
          ? inItinerary.has(recordId)
            ? 'added'
            : { busy: addingStopId === recordId, onAdd: () => addToItinerary(recordId, data) }
          : undefined
      }
    />
  )

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Useful stops</h2>
        <p className="text-xs text-muted-foreground">
          Kinds of stops worth planning for along this route. Find and confirm specific places yourself.
        </p>
      </div>

      <div data-testid="saved-stops">
        <h3 className="mb-2 text-sm font-semibold">Saved stops ({saved.length})</h3>
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canEdit ? 'Save the suggestions you plan to use.' : 'No stops saved yet.'}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">{saved.map(renderStop)}</ul>
        )}
      </div>

      {suggestions.length > 0 && (
        <div data-testid="suggested-stops">
          <h3 className="mb-2 text-sm font-semibold">Suggestions</h3>
          <ul className="grid gap-3 sm:grid-cols-2">{suggestions.map(renderStop)}</ul>
        </div>
      )}
    </section>
  )
}

function StopCard({ recordId, stop, isSaved, canEdit, disabled, savedByName, onToggle, itinerary }: {
  recordId: string
  stop: StopSuggestion
  isSaved: boolean
  canEdit: boolean
  disabled: boolean
  savedByName?: string
  onToggle: () => void
  /** Saved stops only: already in the itinerary, or a way to add it. */
  itinerary?: 'added' | { busy: boolean; onAdd: () => void }
}) {
  return (
    <li
      data-testid="stop-card"
      data-record-id={recordId}
      className={`rounded-md border p-3 ${isSaved ? 'border-primary bg-primary/5' : 'border-border'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Badge className="capitalize">{stop.category}</Badge>
        {canEdit && (
          <Button
            size="sm"
            variant={isSaved ? 'secondary' : 'outline'}
            aria-label={`${isSaved ? 'Unsave' : 'Save'} stop: ${stop.title}`}
            disabled={disabled}
            onClick={onToggle}
          >
            {isSaved ? <BookmarkCheck /> : <Bookmark />} {isSaved ? 'Saved' : 'Save'}
          </Button>
        )}
      </div>
      <p className="text-sm font-medium">{stop.title}</p>
      <p className="text-sm text-muted-foreground">{stop.reason}</p>
      {/* Attribution shows once the server has confirmed the save. */}
      {isSaved && stop.saved && savedByName && (
        <p className="mt-2 text-xs text-muted-foreground">Saved by {savedByName} · {formatWhen(stop.savedAt)}</p>
      )}
      {itinerary === 'added' ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
          <CalendarCheck className="size-3.5" aria-hidden /> In itinerary
        </p>
      ) : itinerary ? (
        <Button size="sm" variant="ghost" className="mt-2 -ml-2" disabled={itinerary.busy} onClick={itinerary.onAdd}
          aria-label={`Add to itinerary: ${stop.title}`}>
          <CalendarPlus /> Add to itinerary
        </Button>
      ) : null}
    </li>
  )
}
