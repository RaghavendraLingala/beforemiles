/**
 * Home dashboard. Signed out: what the app is and how to start. Signed in:
 * quick actions, upcoming trips (live), and what to do next.
 */

import { Link } from 'react-router-dom'
import { useAuthProfileReady, useQuery } from 'deepspace'
import { ArrowRight, CalendarDays, MapPin, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatTripDateRange } from '@/lib/format'
import type { Trip } from '../../schemas/trips-schema'

export default function HomePage() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            {isSignedIn && user ? `Welcome back${user.name ? `, ${user.name}` : ''}` : 'Welcome to BeforeMiles'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your trip, prepared. Keep your trip plans, checklists, and documents together, and prepare with your travel companions.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Link to="/trips?new=1" className={buttonVariants()}>
            <Plus /> Create a trip
          </Link>
          <Link to="/trips" className={buttonVariants({ variant: 'outline' })}>
            View trips
          </Link>
        </div>

        {isSignedIn && <UpcomingTrips />}

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">What to do next</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ['Create a trip', 'Add your route, travel date, mode, and preferences.'],
              ['Generate the report', 'Open the trip’s Report tab for AI-suggested prep.'],
              ['Work the checklist', 'Check items off, save stops, and share with companions.'],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

function UpcomingTrips() {
  const { records: trips, status } = useQuery<Trip>('trips', { orderBy: 'travelDate' })
  const today = new Date().toISOString().slice(0, 10)
  // A multi-day trip stays "upcoming" until its last day.
  const upcoming = trips.filter((t) => (t.data.endDate ?? t.data.travelDate) >= today).slice(0, 3)
  const shown = upcoming.length ? upcoming : trips.slice(-3).reverse()

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{upcoming.length ? 'Upcoming trips' : 'Recent trips'}</h2>
        {trips.length > 0 && (
          <Link to="/trips" className="text-sm text-primary hover:underline">
            All trips ({trips.length})
          </Link>
        )}
      </div>
      {status === 'loading' ? (
        <p className="text-sm text-muted-foreground">Loading trips…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          No trips yet. Create your first trip to generate a readiness report.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {shown.map((t) => (
            <li key={t.recordId}>
              <Link
                to={`/trips/${t.recordId}`}
                className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span className="font-semibold">{t.data.name}</span>
                <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" aria-hidden /> {t.data.destination}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden /> {formatTripDateRange(t.data.travelDate, t.data.endDate)}
                </span>
                <span className={cn('mt-3 inline-flex items-center gap-1 text-sm text-primary')}>
                  Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
