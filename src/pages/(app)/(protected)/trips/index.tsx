/**
 * Trips list + "New trip" form. Every list here is a live `useQuery`: the
 * RecordRoom only ships rows for trips the caller owns or is a member of, so
 * there is no client filtering. `?new=1` opens the form directly.
 */

import { useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { AlertCircle, CalendarDays, Map as MapIcon, Plus, Users } from 'lucide-react'
import { Badge, Button, EmptyState, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { formatTripDateRange, tripLengthDays } from '@/lib/format'
import { computeReadinessScore } from '@/lib/readiness-score'
import { DEFAULT_TRIP_STYLE, TRIP_TEMPLATES, type TripTemplate } from '@/lib/trip-templates'
import { useUserPreferences } from '@/lib/use-user-preferences'
import type { UserPreferences } from '../../../../schemas/user-preferences-schema'
import { cn } from '@/lib/utils'
import {
  TRAVEL_MODES,
  TRIP_PREFERENCES,
  TRIP_TYPES,
  type Trip,
} from '../../../../schemas/trips-schema'
import type { TeamMember } from '../../../../schemas/team-members-schema'
import type { Report } from '../../../../schemas/reports-schema'
import type { ChecklistItem } from '../../../../schemas/checklist-items-schema'
import type { StopSuggestion } from '../../../../schemas/stop-suggestions-schema'

export default function TripsPage() {
  const { userId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { records: trips, status } = useQuery<Trip>('trips', { orderBy: 'travelDate' })
  const { records: memberships } = useQuery<TeamMember>('team_members', { where: { UserId: userId ?? '' } })
  const { records: reports } = useQuery<Report>('reports')
  const { records: items } = useQuery<ChecklistItem>('checklist_items')
  const { records: stops } = useQuery<StopSuggestion>('stop_suggestions')
  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1')

  function openForm(open: boolean) {
    setFormOpen(open)
    if (!open && searchParams.has('new')) setSearchParams({}, { replace: true })
  }

  const roleFor = (tripId: string) => memberships.find((m) => m.data.TeamId === tripId)?.data.Role
  const hasReport = (tripId: string) => reports.some((r) => r.data.tripId === tripId)
  const scoreFor = (tripId: string) =>
    computeReadinessScore(
      items.filter((i) => i.data.tripId === tripId).map((i) => i.data),
      stops.filter((s) => s.data.tripId === tripId).map((s) => s.data),
    )?.score

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your trips</h1>
            <p className="mt-1 text-sm text-muted-foreground">Trips you own or that were shared with you.</p>
          </div>
          {!formOpen && (
            <Button onClick={() => openForm(true)}>
              <Plus /> New trip
            </Button>
          )}
        </div>

        {formOpen && <NewTripFormWithDefaults onCancel={() => openForm(false)} />}

        {status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Loading trips…</p>
        ) : trips.length === 0 ? (
          !formOpen && (
            <section className="rounded-xl border border-dashed border-border bg-card">
              <EmptyState
                icon={<MapIcon />}
                title="No trips yet"
                description="No trips yet. Create your first trip to generate a readiness report."
                action={{ label: 'Create your first trip', onClick: () => openForm(true) }}
              />
            </section>
          )
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.recordId}>
                <TripCard
                  tripId={trip.recordId}
                  trip={trip.data}
                  role={roleFor(trip.recordId)}
                  hasReport={hasReport(trip.recordId)}
                  score={scoreFor(trip.recordId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TripCard({ tripId, trip, role, hasReport, score }: {
  tripId: string
  trip: Trip
  role?: string
  hasReport: boolean
  score?: number
}) {
  return (
    <Link
      to={`/trips/${tripId}`}
      className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">{trip.name}</span>
        {role && <Badge variant={role === 'owner' ? 'default' : 'secondary'} className="shrink-0 capitalize">{role}</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {trip.startLocation} → {trip.destination}
      </p>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden /> {formatTripDateRange(trip.travelDate, trip.endDate)}
        {tripLengthDays(trip.travelDate, trip.endDate) > 1 && <span>· {tripLengthDays(trip.travelDate, trip.endDate)} days</span>}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-secondary px-2 py-0.5 capitalize text-secondary-foreground">{trip.travelMode}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 capitalize text-secondary-foreground">{trip.tripType}</span>
        <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
          <Users className="size-3" aria-hidden /> {trip.travelers}
        </span>
        <span className="ml-auto text-muted-foreground">
          {hasReport ? (score !== undefined ? `Readiness ${score}/100` : 'Report ready') : 'Report not generated'}
        </span>
      </div>
    </Link>
  )
}

const optionPill =
  'cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm capitalize transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50'

/** Waits for the user's saved defaults (Settings) so they never flicker in after typing starts. */
function NewTripFormWithDefaults({ onCancel }: { onCancel: () => void }) {
  const { loading, prefs } = useUserPreferences()
  if (loading) return <p className="mb-8 text-sm text-muted-foreground">Loading your defaults…</p>
  return <NewTripForm onCancel={onCancel} defaults={prefs} />
}

function NewTripForm({ onCancel, defaults }: {
  onCancel: () => void
  defaults: Omit<UserPreferences, 'userId'>
}) {
  const navigate = useNavigate()
  const { error } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Trip style is controlled so a template can fill it; the user can still change any of it.
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [tripType, setTripType] = useState<string>(DEFAULT_TRIP_STYLE.tripType)
  // "No template" = the user's own defaults from Settings (app defaults if none saved).
  const userStyle = {
    tripType: DEFAULT_TRIP_STYLE.tripType,
    travelMode: defaults.defaultTravelMode,
    preferences: defaults.defaultPreferences,
  }
  const [travelMode, setTravelMode] = useState<string>(userStyle.travelMode)
  const [preferences, setPreferences] = useState<string[]>([...userStyle.preferences])
  const [startDate, setStartDate] = useState('')

  function applyTemplate(template: TripTemplate | null) {
    const style = template ?? userStyle
    setTemplateId(template?.id ?? null)
    setTripType(style.tripType)
    setTravelMode(style.travelMode)
    setPreferences([...style.preferences])
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSubmitting(true)
    setFormError(null)
    const result = await callAction<{ tripId: string }>('createTrip', {
      name: form.get('name'),
      startLocation: form.get('startLocation'),
      destination: form.get('destination'),
      stops: String(form.get('stops') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      travelDate: form.get('travelDate'),
      endDate: form.get('endDate') ?? '',
      tripType,
      travelMode,
      travelers: Number(form.get('travelers')),
      preferences,
    })
    setSubmitting(false)
    if (result.success) {
      navigate(`/trips/${result.data.tripId}`)
    } else {
      setFormError(result.error)
      error('Could not create trip', result.error)
    }
  }

  function togglePreference(p: string) {
    setPreferences((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  return (
    <form onSubmit={onSubmit} className="mb-8 space-y-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">New trip</h2>
        <p className="text-sm text-muted-foreground">
          You can generate the readiness report right after creating the trip.
        </p>
      </div>

      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {formError}
        </p>
      )}

      <TemplatePicker selectedId={templateId} onSelect={applyTemplate} />

      <FormGroup title="Route">
        <Field label="Trip name" name="name" placeholder="Coastal weekend" maxLength={120} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start location" name="startLocation" placeholder="San Francisco, CA" maxLength={200} required />
          <Field label="Destination" name="destination" placeholder="Big Sur, CA" maxLength={200} required />
        </div>
        <Field
          label="Stops (optional, comma-separated)"
          name="stops"
          placeholder="Santa Cruz, Monterey"
          hint="Up to 10 places you plan to pass through."
        />
      </FormGroup>

      <FormGroup title="When & who">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Travel start date"
            name="travelDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Field
            label="Return date (optional)"
            name="endDate"
            type="date"
            min={startDate || undefined}
            hint="Leave empty for a one-day trip."
          />
          <Field label="Travelers" name="travelers" type="number" min={1} max={50} defaultValue={defaults.defaultTravelers} required />
        </div>
      </FormGroup>

      <FormGroup title="Trip style">
        <OptionGroup legend="Trip type" name="tripType" options={TRIP_TYPES} value={tripType} onChange={setTripType} />
        <OptionGroup legend="Travel mode" name="travelMode" options={TRAVEL_MODES} value={travelMode} onChange={setTravelMode} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Preferences</legend>
          <p className="text-xs text-muted-foreground">The report prioritizes these when suggesting stops and prep.</p>
          <div className="flex flex-wrap gap-2">
            {TRIP_PREFERENCES.map((p) => (
              <label key={p} className={optionPill}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={preferences.includes(p)}
                  onChange={() => togglePreference(p)}
                />
                {p}
              </label>
            ))}
          </div>
        </fieldset>
      </FormGroup>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create trip'}</Button>
      </div>
    </form>
  )
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function TemplatePicker({ selectedId, onSelect }: {
  selectedId: string | null
  onSelect: (template: TripTemplate | null) => void
}) {
  return (
    <section className="space-y-2 rounded-lg bg-secondary p-4">
      <h3 className="text-sm font-medium">Start from a template (optional)</h3>
      <p className="text-xs text-muted-foreground">
        Fills trip type, travel mode, and preferences. Your route stays yours, and you can change anything after.
      </p>
      <div role="group" aria-label="Trip templates" className="flex flex-wrap gap-2">
        {TRIP_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={selectedId === t.id}
            onClick={() => onSelect(t)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              selectedId === t.id
                ? 'border-primary bg-card font-medium text-accent-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {t.label}
          </button>
        ))}
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear template
          </button>
        )}
      </div>
    </section>
  )
}

function OptionGroup({ legend, name, options, value, onChange }: {
  legend: string
  name: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className={optionPill}>
            <input
              type="radio"
              name={name}
              value={o}
              checked={o === value}
              onChange={() => onChange(o)}
              className="sr-only"
            />
            {o === 'ev' ? 'EV' : o}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Field({ label, name, hint, className, ...props }: {
  label: string
  name: string
  hint?: string
} & ComponentProps<typeof Input>) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
