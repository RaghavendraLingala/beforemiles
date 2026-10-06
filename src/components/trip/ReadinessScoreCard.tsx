import { useQuery } from 'deepspace'
import { computeReadinessScore, STOPS_FOR_FULL_POINTS } from '@/lib/readiness-score'
import type { ChecklistItem } from '../../schemas/checklist-items-schema'
import type { StopSuggestion } from '../../schemas/stop-suggestions-schema'

/** Live readiness score; recomputes whenever any member checks an item or saves a stop. */
export function ReadinessScoreCard({ tripId }: { tripId: string }) {
  const { records: items } = useQuery<ChecklistItem>('checklist_items', { where: { tripId } })
  const { records: stops } = useQuery<StopSuggestion>('stop_suggestions', { where: { tripId } })
  const result = computeReadinessScore(
    items.map((i) => i.data),
    stops.map((s) => s.data),
  )

  return (
    <section className="rounded-lg border border-border bg-card p-6" aria-labelledby="readiness-heading">
      <h2 id="readiness-heading" className="text-lg font-semibold">Readiness score</h2>
      <p className="mb-3 text-xs text-muted-foreground">Measures preparation progress — not how safe a trip is.</p>
      {!result ? (
        <p className="text-sm text-muted-foreground">Generate a report to get a checklist and a readiness score.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span data-testid="readiness-score" className="text-4xl font-bold tabular-nums">{result.score}</span>
            <span className="text-muted-foreground">/ 100</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${result.score}%` }} />
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">Checklist: </dt>
              <dd className="inline">{result.checked}/{result.total} done → {result.checklistPoints}/80 pts</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Saved stops: </dt>
              <dd className="inline">
                {Math.min(result.savedStops, STOPS_FOR_FULL_POINTS)}/{STOPS_FOR_FULL_POINTS} → {result.stopPoints}/20 pts
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  )
}
