import { useState } from 'react'
import { useQuery, useUserLookup } from 'deepspace'
import { Check, Info, ListPlus, SearchCheck } from 'lucide-react'
import { Badge, Button, useToast, type BadgeProps } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { normalize } from '@/lib/regeneration'
import { formatWhen } from '@/lib/use-pending'
import type { ChecklistItem } from '../../schemas/checklist-items-schema'
import type { ReadinessReview, ReviewSuggestion } from '../../schemas/readiness-reviews-schema'

const PRIORITY_BADGE: Record<ReviewSuggestion['priority'], BadgeProps['variant']> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
}

/** "What am I missing?" — an AI review of the trip's current state. */
export function HelpSection({ tripId, canEdit }: { tripId: string; canEdit: boolean }) {
  const { records } = useQuery<ReadinessReview>('readiness_reviews', { where: { tripId } })
  const { records: items } = useQuery<ChecklistItem>('checklist_items', { where: { tripId } })
  const { getUser } = useUserLookup()
  const { success, error } = useToast()
  const [running, setRunning] = useState(false)
  const review = records[0]?.data
  const onChecklist = new Set(items.map((i) => normalize(i.data.text)))

  async function runReview() {
    setRunning(true)
    const result = await callAction<{ count: number }>('generateReadinessReview', { tripId })
    setRunning(false)
    if (result.success) success('Review ready', `${result.data.count} suggestions for this trip.`)
    else error('Could not run review', result.error)
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">What am I missing?</h2>
        {canEdit && (
          <Button size="sm" onClick={runReview} disabled={running}>
            <SearchCheck /> {running ? 'Reviewing… (up to a minute)' : review ? 'Review again' : 'What am I missing?'}
          </Button>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Reviews this trip as it stands — details, report, checklist progress, saved stops, documents, and score —
        and suggests the most useful preparation steps still missing.
      </p>

      <div className="mb-5 rounded-lg bg-secondary p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Info className="size-4 shrink-0 text-primary" aria-hidden />
          AI-generated planning suggestions. Check important details before you travel.
        </p>
        <p className="mt-1 pl-6 text-muted-foreground">
          Reviews use general knowledge — not live weather, traffic, verified places, or emergency data.
        </p>
      </div>

      {!review ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'No review yet. Run one to see what this trip still needs.'
            : 'No review yet. The trip owner or an editor can run one.'}
        </p>
      ) : (
        <>
          <ol className="space-y-3" data-testid="review-suggestions">
            {review.suggestions.map((s, i) => (
              <li key={i} data-testid="review-suggestion" className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={PRIORITY_BADGE[s.priority]} className="capitalize">{s.priority}</Badge>
                    <h3 className="font-semibold">{s.title}</h3>
                  </div>
                  {canEdit && (
                    <AddToChecklist tripId={tripId} suggestion={s} added={onChecklist.has(normalize(s.checklistItem))} />
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.reason}</p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Suggested action:</span> {s.action}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Reviewed {formatWhen(review.generatedAt)} by {getUser(review.generatedBy)?.name ?? 'a member'}
            {review.scoreAtReview !== undefined && ` · readiness was ${review.scoreAtReview}/100`} · {review.model}
          </p>
        </>
      )}
    </section>
  )
}

function AddToChecklist({ tripId, suggestion, added }: {
  tripId: string
  suggestion: ReviewSuggestion
  added: boolean
}) {
  const { error } = useToast()
  const [busy, setBusy] = useState(false)

  if (added) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-primary">
        <Check className="size-4" aria-hidden /> On checklist
      </span>
    )
  }

  async function add() {
    setBusy(true)
    const result = await callAction('addManualChecklistItem', {
      tripId,
      text: suggestion.checklistItem,
      category: suggestion.category,
    })
    setBusy(false)
    if (!result.success) error('Could not add to checklist', result.error)
  }

  return (
    <Button size="sm" variant="outline" onClick={add} disabled={busy} aria-label={`Add to checklist: ${suggestion.title}`}>
      <ListPlus /> Add to checklist
    </Button>
  )
}
