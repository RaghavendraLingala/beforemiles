/**
 * Landing page — a STATIC page (top level of src/pages/, outside (app)/), so
 * it loads with no auth request and no realtime connection. "Start planning"
 * links to /trips, which is protected: signed-out visitors get the sign-in
 * prompt there, signed-in users land straight on their trips.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  FileLock2,
  Gauge,
  ListChecks,
  MapPinned,
  Share2,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { BrandMark } from '../components/BrandMark'

const STEPS = [
  { title: 'Create a trip', body: 'Where you’re going, when, how you’re traveling, and who’s coming.' },
  { title: 'Get a Trip Readiness Report', body: 'Suggested packing, clothing, safety notes, and emergency prep for this trip — AI-generated, so check the details.' },
  { title: 'Share the to-dos', body: 'A before-you-leave checklist with your own items, assigned to the people you’re traveling with.' },
  { title: 'Plan stops & the day', body: 'Save the restroom, fuel, rest, and medical stops worth planning for, and put your day in order.' },
  { title: 'Keep documents together', body: 'Tickets, bookings, permits, and screenshots, kept with the trip and private to it.' },
  { title: 'Spot what’s missing', body: 'Ask “What am I missing?” to see what still needs attention before you go.' },
]

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <Sparkles />,
    title: 'Trip Readiness Report',
    body: 'Preparation suggestions for your route, dates, and travel mode — AI-generated and clearly labelled, so you know what to double-check.',
  },
  {
    icon: <ListChecks />,
    title: 'Shared checklist',
    body: 'Suggested items plus your own, assigned to travelers. Everyone sees what’s done as it happens.',
  },
  {
    icon: <MapPinned />,
    title: 'Useful stops & itinerary',
    body: 'Save the stops worth planning for, then lay out your day: departure, meals, fuel, and arrival.',
  },
  {
    icon: <FileLock2 />,
    title: 'Documents in one place',
    body: 'Tickets, bookings, and permits stay with the trip and open only for its members.',
  },
  {
    icon: <Users />,
    title: 'A role for every companion',
    body: 'Owners manage sharing, editors help plan, viewers follow along — and it holds for every change.',
  },
  {
    icon: <Gauge />,
    title: 'What am I missing?',
    body: 'A review of your plan that points out what still needs attention, plus a preparation score that tracks progress — not trip safety.',
  },
]

const SHARED_PLANNING = [
  ['Private by default', 'Only you and the people you invite can see a trip.'],
  ['Clear roles', 'Owners, editors, and viewers — checked for every change.'],
  ['Everyone stays in sync', 'Checklist ticks, saved stops, itinerary changes, and new documents show up for the whole group.'],
  ['Documents together', 'Trip files open only for members of the trip.'],
  ['Readiness reports', 'AI-generated planning suggestions, always labelled as such.'],
  ['One shared plan', 'No copies to keep in sync.'],
] as const

export default function Landing() {
  return (
    <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <BrandMark />
          <nav className="ml-auto hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
          </nav>
          <Link
            to="/trips"
            className="ml-auto inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:ml-0"
          >
            Start planning
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            <p className="mb-3 text-sm font-medium text-primary">Collaborative trip readiness planner</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your trip, prepared.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Keep your trip plans, checklists, and documents together, and prepare with your travel companions.
            </p>
            <ul className="mt-5 grid max-w-xl gap-2 text-sm sm:grid-cols-2">
              {[
                'Prepare before you go',
                'Plans and documents in one place',
                'Share the to-dos with companions',
                'Spot what still needs attention',
              ].map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden /> {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/trips"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Start planning <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 font-medium hover:bg-accent"
              >
                View how it works
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free to try. Sign in with Google or GitHub.</p>
          </div>
          <ExampleTripCard />
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-4 border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">From an idea to a trip you’re ready for, in six steps.</p>
            <ol className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Everything your trip prep needs</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-5">
                  {f.icon}
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Scope + platform */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Before the miles, not during them</h2>
              <p className="mt-3 text-muted-foreground">
                BeforeMiles helps you prepare before you leave — it isn&apos;t a turn-by-turn navigation app. Keep
                using your maps and weather apps on the road.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Readiness reports and “What am I missing?” reviews are AI-generated planning suggestions from
                general knowledge. They don&apos;t include live weather, traffic, closures, or verified places —
                check important details before you travel.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Built for shared planning</h2>
              <p className="mt-3 text-muted-foreground">
                Keep your trip plans, checklists, and documents together, and prepare with your travel companions.
              </p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {SHARED_PLANNING.map(([name, body]) => (
                  <div key={name} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <dt className="text-sm font-semibold">{name}</dt>
                      <dd className="text-sm text-muted-foreground">{body}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready for your next trip?</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Create a trip, see what it still needs, and share the preparation with the people you&apos;re traveling with.
          </p>
          <Link
            to="/trips"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start planning <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <BrandMark className="text-sm" />
          <span>Your trip, prepared · beforemiles.app.space</span>
        </div>
      </footer>
    </div>
  )
}

/** Static illustration of what a trip looks like — labelled as an example. */
function ExampleTripCard() {
  const items = [
    { text: 'Download offline maps for the Highway 1 corridor', done: true },
    { text: 'Check tire pressure and fill up in Monterey', done: true },
    { text: 'Confirm lodging check-in time', done: false, who: 'Sam' },
    { text: 'Note nearest hospitals along the route', done: false },
  ]
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(16,24,40,0.06)]" aria-label="Example trip">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Example trip</p>
          <p className="mt-1 font-semibold">Coastal weekend</p>
          <p className="text-sm text-muted-foreground">San Francisco → Big Sur · Nov 1–3 · Car</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums text-primary">72</p>
          <p className="text-xs text-muted-foreground">readiness</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-[72%] bg-primary" />
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.text} className="flex items-start gap-2">
            <CheckCircle2
              className={`mt-0.5 size-4 shrink-0 ${item.done ? 'text-primary' : 'text-border'}`}
              aria-hidden
            />
            <span className={item.done ? 'text-muted-foreground line-through' : ''}>{item.text}</span>
            {item.who && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.who}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
          <BookmarkCheck className="size-3.5" aria-hidden /> 3 stops saved
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
          <Upload className="size-3.5" aria-hidden /> 2 documents
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
          <Share2 className="size-3.5" aria-hidden /> Shared with 2
        </span>
      </div>
    </div>
  )
}
