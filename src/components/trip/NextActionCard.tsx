import type { ReactNode } from 'react'
import { useQuery } from 'deepspace'
import { ArrowRight, BookmarkPlus, FileUp, ListChecks, PartyPopper, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'
import type { Report } from '../../schemas/reports-schema'
import type { ChecklistItem } from '../../schemas/checklist-items-schema'
import type { StopSuggestion } from '../../schemas/stop-suggestions-schema'
import type { TripDocument } from '../../schemas/trip-documents-schema'
import { STOPS_FOR_FULL_POINTS } from '@/lib/readiness-score'

export type TripTab = 'report' | 'checklist' | 'stops' | 'documents'

type NextAction = { icon: ReactNode; title: string; body: string; tab?: TripTab; cta?: string }

/**
 * The single most useful next step for this trip, derived from live data in
 * a fixed order: report → checklist → stops → documents → done.
 */
export function NextActionCard({ tripId, canEdit, onNavigate }: {
  tripId: string
  canEdit: boolean
  onNavigate: (tab: TripTab) => void
}) {
  const { records: reports } = useQuery<Report>('reports', { where: { tripId } })
  const { records: items } = useQuery<ChecklistItem>('checklist_items', { where: { tripId } })
  const { records: stops } = useQuery<StopSuggestion>('stop_suggestions', { where: { tripId } })
  const { records: documents } = useQuery<TripDocument>('trip_documents', { where: { tripId } })

  const remaining = items.filter((i) => !i.data.checked).length
  const saved = stops.filter((s) => s.data.saved).length
  const action = pickAction({ hasReport: reports.length > 0, remaining, saved, stops: stops.length, documents: documents.length, canEdit })

  return (
    <section className="rounded-xl border border-primary/30 bg-accent/60 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">Next best action</h2>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <div className="flex min-w-60 flex-1 items-start gap-3">
          <span className="mt-0.5 text-primary [&_svg]:size-5">{action.icon}</span>
          <div>
            <p className="font-semibold">{action.title}</p>
            <p className="text-sm text-muted-foreground">{action.body}</p>
          </div>
        </div>
        {action.tab && (
          <Button size="sm" onClick={() => onNavigate(action.tab!)}>
            {action.cta} <ArrowRight />
          </Button>
        )}
      </div>
    </section>
  )
}

function pickAction(s: {
  hasReport: boolean
  remaining: number
  saved: number
  stops: number
  documents: number
  canEdit: boolean
}): NextAction {
  if (!s.hasReport) {
    return {
      icon: <Sparkles />,
      title: s.canEdit ? 'Create the readiness report' : 'Waiting for the readiness report',
      body: s.canEdit
        ? 'Get AI-suggested packing, safety, and emergency prep, plus a checklist and useful stops.'
        : 'An owner or editor can create it from the Report tab.',
      tab: 'report',
      cta: 'Open Report',
    }
  }
  if (s.remaining > 0) {
    return {
      icon: <ListChecks />,
      title: `${s.remaining} checklist ${s.remaining === 1 ? 'item' : 'items'} left`,
      body: 'Checking items off raises the readiness score for everyone on the trip.',
      tab: 'checklist',
      cta: 'Open Checklist',
    }
  }
  if (s.stops > 0 && s.saved < STOPS_FOR_FULL_POINTS) {
    return {
      icon: <BookmarkPlus />,
      title: `Save useful stops (${s.saved}/${STOPS_FOR_FULL_POINTS})`,
      body: 'Pick the restroom, fuel, rest, or medical stops you plan to use along the route.',
      tab: 'stops',
      cta: 'Open Stops',
    }
  }
  if (s.documents === 0) {
    return {
      icon: <FileUp />,
      title: 'Add key documents',
      body: 'Keep tickets, bookings, and permits with the trip — private to its members.',
      tab: 'documents',
      cta: 'Open Documents',
    }
  }
  return {
    icon: <PartyPopper />,
    title: 'You’re ready to go',
    body: 'Checklist done, stops saved, documents attached. Re-check conditions the day before you leave.',
  }
}
