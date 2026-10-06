import { useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from 'deepspace'
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Circle,
  Flag,
  Fuel,
  MapPin,
  MapPinCheck,
  Mountain,
  Pencil,
  Plus,
  Siren,
  Trash2,
  Utensils,
} from 'lucide-react'
import { Button, ConfirmModal, EmptyState, Input, Label, Textarea, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { formatTripDate } from '@/lib/format'
import { sortItinerary, tripDayNumber } from '@/lib/itinerary'
import {
  ITINERARY_ITEM_TYPES,
  type ItineraryItem,
  type ItineraryItemType,
} from '../../schemas/itinerary-items-schema'
import type { Trip } from '../../schemas/trips-schema'

const TYPE_ICON: Record<ItineraryItemType, ReactNode> = {
  start: <Flag />,
  stop: <MapPin />,
  food: <Utensils />,
  fuel: <Fuel />,
  emergency: <Siren />,
  activity: <Mountain />,
  destination: <MapPinCheck />,
  custom: <Circle />,
}

const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize text-foreground'

type Draft = Pick<ItineraryItem, 'title' | 'itemType'> & { location: string; notes: string; plannedDate: string; plannedTime: string }

export function ItinerarySection({ tripId, trip, canEdit }: {
  tripId: string
  trip: Pick<Trip, 'travelDate' | 'endDate'>
  canEdit: boolean
}) {
  const { records } = useQuery<ItineraryItem>('itinerary_items', { where: { tripId } })
  const { error } = useToast()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)

  const items = sortItinerary(records.map((r) => ({ ...r, order: Number(r.data.order) || 0 })))
  const multiDay = !!trip.endDate && trip.endDate !== trip.travelDate
  const emptyDraft: Draft = {
    title: '',
    itemType: items.length === 0 ? 'start' : 'stop',
    location: '',
    notes: '',
    // One-day trips: everything happens on the travel date.
    plannedDate: multiDay ? '' : trip.travelDate,
    plannedTime: '',
  }

  async function run(itemId: string, name: string, params: Record<string, unknown>) {
    setBusyId(itemId)
    const result = await callAction(name, { itemId, ...params })
    setBusyId(null)
    if (!result.success) error('Could not update itinerary', result.error)
    return result.success
  }

  const removing = items.find((i) => i.recordId === removeId)

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Itinerary</h2>
        {canEdit && !adding && (
          <Button size="sm" onClick={() => { setAdding(true); setEditingId(null) }}>
            <Plus /> Add item
          </Button>
        )}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Plan the order of your day{multiDay ? 's' : ''}: departure, stops, meals, fuel, and arrival. Dates and
        times are your plan — BeforeMiles doesn&apos;t add live traffic or travel times.
        {!canEdit && ' You have view access, so the timeline is read-only.'}
      </p>

      {adding && (
        <ItemForm
          trip={trip}
          initial={emptyDraft}
          submitLabel="Add to timeline"
          onCancel={() => setAdding(false)}
          onSubmit={async (draft) => {
            const result = await callAction('addItineraryItem', { tripId, ...draft })
            if (!result.success) {
              error('Could not add item', result.error)
              return false
            }
            setAdding(false)
            return true
          }}
        />
      )}

      {items.length === 0 ? (
        !adding && (
          <EmptyState
            icon={<CalendarClock />}
            title="No itinerary yet"
            description={
              canEdit
                ? 'Add your departure, planned stops, and arrival — or add saved stops from the Stops tab.'
                : 'The trip owner or an editor can build the timeline.'
            }
            className="py-10"
          />
        )
      ) : (
        <ol className="relative space-y-3" data-testid="itinerary-list">
          {items.map((item, index) => {
            const d = item.data
            if (editingId === item.recordId) {
              return (
                <li key={item.recordId}>
                  <ItemForm
                    trip={trip}
                    initial={{
                      title: d.title,
                      itemType: d.itemType,
                      location: d.location ?? '',
                      notes: d.notes ?? '',
                      plannedDate: d.plannedDate ?? '',
                      plannedTime: d.plannedTime ?? '',
                    }}
                    submitLabel="Save changes"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (draft) => {
                      const ok = await run(item.recordId, 'updateItineraryItem', draft)
                      if (ok) setEditingId(null)
                      return ok
                    }}
                  />
                </li>
              )
            }
            const day = multiDay ? tripDayNumber(trip.travelDate, d.plannedDate) : null
            const when = [day ? `Day ${day}` : null, d.plannedDate ? formatTripDate(d.plannedDate) : null, d.plannedTime || null]
              .filter(Boolean)
              .join(' · ')
            const busy = busyId === item.recordId
            return (
              <li
                key={item.recordId}
                data-record-id={item.recordId}
                data-testid="itinerary-item"
                className="flex flex-wrap gap-3 rounded-lg border border-border p-4"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-4">
                  {TYPE_ICON[d.itemType] ?? TYPE_ICON.custom}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{d.title}</span>
                    <span className="text-xs capitalize text-muted-foreground">{d.itemType}</span>
                  </div>
                  {when && <p className="text-sm text-muted-foreground">{when}</p>}
                  {d.location && (
                    <p className="flex items-center gap-1 text-sm">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> {d.location}
                    </p>
                  )}
                  {d.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{d.notes}</p>}
                </div>
                {canEdit && (
                  // Phones: controls get their own row under the item instead of squeezing the text.
                  <div className="-mb-2 flex w-full shrink-0 items-start justify-end gap-0.5 sm:mb-0 sm:w-auto">
                    <IconButton label={`Move up: ${d.title}`} disabled={busy || index === 0}
                      onClick={() => run(item.recordId, 'moveItineraryItem', { direction: 'up' })}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label={`Move down: ${d.title}`} disabled={busy || index === items.length - 1}
                      onClick={() => run(item.recordId, 'moveItineraryItem', { direction: 'down' })}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label={`Edit: ${d.title}`} disabled={busy}
                      onClick={() => { setEditingId(item.recordId); setAdding(false) }}>
                      <Pencil />
                    </IconButton>
                    <IconButton label={`Remove: ${d.title}`} disabled={busy} onClick={() => setRemoveId(item.recordId)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoveId(null)}
        title="Remove from itinerary?"
        description={removing ? `“${removing.data.title}” will be removed for everyone on this trip.` : undefined}
        confirmText="Remove"
        loading={busyId === removeId}
        onConfirm={async () => {
          if (removeId && (await run(removeId, 'removeItineraryItem', {}))) setRemoveId(null)
        }}
      />
    </section>
  )
}

function IconButton({ label, disabled, onClick, children }: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button type="button" size="icon" variant="ghost" aria-label={label} title={label} disabled={disabled}
      onClick={onClick} className="size-9 [&_svg]:size-4">
      {children}
    </Button>
  )
}

function ItemForm({ trip, initial, submitLabel, onCancel, onSubmit }: {
  trip: Pick<Trip, 'travelDate' | 'endDate'>
  initial: Draft
  submitLabel: string
  onCancel: () => void
  onSubmit: (draft: Draft) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await onSubmit(draft)
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-dashed border-border p-4" aria-label="Itinerary item">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="it-title">Title</Label>
          <Input id="it-title" required maxLength={120} placeholder="Leave San Francisco"
            value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="it-type">Type</Label>
          <select id="it-type" className={selectClass} value={draft.itemType}
            onChange={(e) => set('itemType', e.target.value as ItineraryItemType)}>
            {ITINERARY_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="it-date">Date (optional)</Label>
          <Input id="it-date" type="date" min={trip.travelDate} max={trip.endDate || undefined}
            value={draft.plannedDate} onChange={(e) => set('plannedDate', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="it-time">Time (optional)</Label>
          <Input id="it-time" type="time" value={draft.plannedTime} onChange={(e) => set('plannedTime', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="it-location">Location (optional)</Label>
          <Input id="it-location" maxLength={200} placeholder="Monterey, CA"
            value={draft.location} onChange={(e) => set('location', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="it-notes">Notes (optional)</Label>
        <Textarea id="it-notes" rows={2} maxLength={1000} placeholder="Reservation at 12:30, parking behind the building"
          value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy || !draft.title.trim()}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}
