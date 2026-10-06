import { useState } from 'react'
import { useQuery, useUserLookup } from 'deepspace'
import { Info, Sparkles } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import type { ReadinessContent, Report } from '../../schemas/reports-schema'

const SECTIONS: { key: keyof Omit<ReadinessContent, 'summary'>; title: string }[] = [
  { key: 'weatherPrep', title: 'Weather-aware preparation' },
  { key: 'whatToCarry', title: 'What to carry' },
  { key: 'clothing', title: 'Clothing' },
  { key: 'emergencyPreparedness', title: 'Emergency preparedness' },
  { key: 'safetyNotes', title: 'Safety notes' },
]

export function ReportSection({ tripId, canEdit }: { tripId: string; canEdit: boolean }) {
  const { getUser } = useUserLookup()
  const { records } = useQuery<Report>('reports', { where: { tripId } })
  const { success, error } = useToast()
  const [generating, setGenerating] = useState(false)
  const report = records[0]?.data

  async function generate() {
    setGenerating(true)
    const result = await callAction<{ checklistCount: number; stopCount: number }>('generateReport', { tripId })
    setGenerating(false)
    if (result.success) {
      success('Report ready', `${result.data.checklistCount} new checklist items, ${result.data.stopCount} new stop ideas.`)
    } else {
      error('Could not generate report', result.error)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Trip Readiness Report</h2>
        {canEdit && (
          <Button onClick={generate} disabled={generating} size="sm">
            <Sparkles /> {generating ? 'Generating… (up to a minute)' : report ? 'Regenerate' : 'Generate report'}
          </Button>
        )}
      </div>

      <div className="mb-5 rounded-lg bg-secondary p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Info className="size-4 shrink-0 text-primary" aria-hidden />
          AI-generated planning suggestions. Check important details before you travel.
        </p>
        <div className="mt-2 grid gap-3 text-muted-foreground sm:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">What it is:</span> trip-specific prep advice from
            general knowledge — what to carry, clothing, safety, and emergency resources to locate — plus a
            starter checklist and useful stop ideas.
          </p>
          <p>
            <span className="font-medium text-foreground">What it isn&apos;t:</span> a live forecast, traffic,
            road closures, verified businesses, or an emergency service. Check official sources before you travel.
          </p>
        </div>
      </div>

      {!report ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'No report yet. Generate one to get packing, safety and emergency guidance for this trip.'
            : 'No report yet. The trip owner or an editor can generate one.'}
        </p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm">{report.content.summary}</p>
          {SECTIONS.map(({ key, title }) =>
            report.content[key]?.length ? (
              <div key={key}>
                <h3 className="mb-1 text-sm font-semibold">{title}</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {report.content[key].map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            ) : null,
          )}
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generatedAt).toLocaleString()} by{' '}
            {getUser(report.generatedBy)?.name ?? 'a member'} · {report.model}
          </p>
        </div>
      )}
    </section>
  )
}
