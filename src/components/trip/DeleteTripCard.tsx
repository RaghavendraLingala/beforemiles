import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'

/** Owner-only danger zone: permanently deletes the trip for every member. */
export function DeleteTripCard({ tripId, tripName }: { tripId: string; tripName: string }) {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteTrip() {
    setDeleting(true)
    const result = await callAction<{ deleted: boolean }>('deleteTrip', { tripId })
    setDeleting(false)
    if (!result.success) {
      error('Could not delete trip', result.error)
      return
    }
    setOpen(false)
    success('Trip deleted', tripName)
    navigate('/trips', { replace: true })
  }

  return (
    <section className="rounded-lg border border-destructive/40 p-6" aria-labelledby="danger-zone">
      <h2 id="danger-zone" className="text-sm font-semibold uppercase tracking-wide text-destructive">Danger zone</h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-sm text-muted-foreground">
          Deleting this trip removes it for every member, along with its report, checklist, stops, itinerary,
          review, and documents. This can&apos;t be undone.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 /> Delete trip
        </Button>
      </div>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={deleteTrip}
        loading={deleting}
        title={`Delete “${tripName}”?`}
        description="Everyone on this trip loses access immediately, and its report, checklist, stops, itinerary, and documents are deleted. This can’t be undone."
        confirmText="Delete trip"
      />
    </section>
  )
}
