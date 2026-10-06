/**
 * Trip detail — a header plus one tab per area of the trip. The active tab
 * lives in the URL (`?tab=checklist`) so it survives reloads and can be linked.
 * Each section queries its own collection; the RecordRoom only ships rows for
 * trips the caller belongs to, and every write goes through an action. Live
 * sync is unaffected by tabs: a section picks up the latest state when shown.
 */

import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { ArrowLeft, Lock } from 'lucide-react'
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { formatTripDateRange, tripLengthDays } from '@/lib/format'
import { ChecklistSection } from '@/components/trip/ChecklistSection'
import { DeleteTripCard } from '@/components/trip/DeleteTripCard'
import { DocumentsSection } from '@/components/trip/DocumentsSection'
import { HelpSection } from '@/components/trip/HelpSection'
import { ItinerarySection } from '@/components/trip/ItinerarySection'
import { MembersSection } from '@/components/trip/MembersSection'
import { NextActionCard } from '@/components/trip/NextActionCard'
import { ReadinessScoreCard } from '@/components/trip/ReadinessScoreCard'
import { ReportSection } from '@/components/trip/ReportSection'
import { StopsSection } from '@/components/trip/StopsSection'
import type { Trip } from '../../../../schemas/trips-schema'
import type { TeamMember } from '../../../../schemas/team-members-schema'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'report', label: 'Report' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'stops', label: 'Stops' },
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'documents', label: 'Documents' },
  { value: 'help', label: 'Help' },
  { value: 'members', label: 'Members' },
] as const
type TabValue = (typeof TABS)[number]['value']

function isTab(value: string | null): value is TabValue {
  return TABS.some((t) => t.value === value)
}

export default function TripDetailPage() {
  const { id = '' } = useParams()
  const { userId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { records: trips, status } = useQuery<Trip>('trips', { where: { tripId: id } })
  const { records: members } = useQuery<TeamMember>('team_members', { where: { TeamId: id } })
  const myMembership = members.filter((m) => m.data.UserId === userId)

  const trip = trips[0]?.data
  const myRole = myMembership[0]?.data.Role
  const canEdit = myRole === 'owner' || myRole === 'editor'
  const requestedTab = searchParams.get('tab')
  const tab: TabValue = isTab(requestedTab) ? requestedTab : 'overview'

  function selectTab(value: unknown) {
    if (typeof value !== 'string' || !isTab(value)) return
    // Replace, not push: switching tabs shouldn't fill the back button history.
    setSearchParams(value === 'overview' ? {} : { tab: value }, { replace: true })
  }

  if (status === 'loading') {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground sm:px-6">Loading trip…</p>
  }
  if (!trip) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <BackLink />
        <section className="mt-4 rounded-xl border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">Trip not available</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This trip doesn&apos;t exist or hasn&apos;t been shared with you. Trips are private until their
            owner shares them — ask the owner to add you from the trip&apos;s Members tab.
          </p>
          <Link to="/trips" className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go to your trips
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        <BackLink />

        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
            <p className="text-muted-foreground">
              {trip.startLocation} → {trip.destination} · {formatTripDateRange(trip.travelDate, trip.endDate)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" data-testid="trip-privacy">
              <Lock className="size-3.5" aria-hidden />
              {members.length > 1 ? `Private · shared with ${members.length} members` : 'Private · only you'}
            </p>
          </div>
          {myRole && <Badge className="shrink-0 capitalize">{myRole}</Badge>}
        </header>

        <Tabs value={tab} onValueChange={selectTab} className="gap-6">
          {/* Eight tabs don't fit a phone; the list scrolls sideways instead of wrapping. */}
          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            <TabsList aria-label="Trip sections" className="h-11">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="px-3.5">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <NextActionCard tripId={id} canEdit={canEdit} onNavigate={selectTab} />
            <ReadinessScoreCard tripId={id} />
            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">Trip details</h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Detail label="Route" value={[trip.startLocation, ...(trip.stops ?? []), trip.destination].join(' → ')} />
                <Detail
                  label={trip.endDate && trip.endDate !== trip.travelDate ? 'Dates' : 'Travel date'}
                  value={`${formatTripDateRange(trip.travelDate, trip.endDate)}${
                    tripLengthDays(trip.travelDate, trip.endDate) > 1 ? ` · ${tripLengthDays(trip.travelDate, trip.endDate)} days` : ''
                  }`}
                />
                <Detail label="Trip type · mode" value={`${trip.tripType} · ${trip.travelMode === 'ev' ? 'EV' : trip.travelMode}`} capitalize />
                <Detail label="Travelers" value={String(trip.travelers)} />
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Preferences</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {trip.preferences?.length ? (
                      trip.preferences.map((p) => (
                        <span key={p} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{p}</span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">None selected</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            {myRole === 'owner' && <DeleteTripCard tripId={id} tripName={trip.name} />}
          </TabsContent>

          <TabsContent value="report">
            <ReportSection tripId={id} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="checklist">
            <ChecklistSection tripId={id} canEdit={canEdit} onOpenReport={() => selectTab('report')} />
          </TabsContent>
          <TabsContent value="stops">
            <StopsSection tripId={id} canEdit={canEdit} onOpenReport={() => selectTab('report')} />
          </TabsContent>
          <TabsContent value="itinerary">
            <ItinerarySection tripId={id} trip={trip} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsSection tripId={id} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="help">
            <HelpSection tripId={id} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="members">
            <MembersSection tripId={id} myRole={myRole} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function Detail({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={capitalize ? 'capitalize' : undefined}>{value}</dd>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/trips" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> All trips
    </Link>
  )
}
