import { useState, type FormEvent } from 'react'
import { useAuth, useQuery, useUserLookup } from 'deepspace'
import { UserMinus } from 'lucide-react'
import { Badge, Button, ConfirmModal, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import type { TeamMember, TripRole } from '../../schemas/team-members-schema'

export function MembersSection({ tripId, myRole }: { tripId: string; myRole?: TripRole }) {
  const { userId } = useAuth()
  const { getUser } = useUserLookup()
  const { records: members } = useQuery<TeamMember>('team_members', { where: { TeamId: tripId } })
  const { success, error } = useToast()
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function removeMember() {
    if (!removing) return
    setBusy(true)
    const result = await callAction('removeTripMember', { membershipId: removing.id })
    setBusy(false)
    if (!result.success) {
      error('Could not remove member', result.error)
      return
    }
    success('Member removed', `${removing.name} no longer has access to this trip.`)
    setRemoving(null)
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold">Members</h2>
      <p className="mb-4 text-sm text-muted-foreground">Everyone here sees this trip and its updates live.</p>
      <ul className="divide-y divide-border">
        {members.map((m) => {
          const name = getUser(m.data.UserId)?.name ?? 'Unknown user'
          return (
            <li key={m.recordId} data-record-id={m.recordId} data-testid="member-row" className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {name}
                {m.data.UserId === userId && <span className="text-muted-foreground"> (you)</span>}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={m.data.Role === 'owner' ? 'default' : 'secondary'} className="capitalize">{m.data.Role}</Badge>
                {myRole === 'owner' && m.data.Role !== 'owner' && (
                  <Button size="sm" variant="ghost" aria-label={`Remove member: ${name}`}
                    onClick={() => setRemoving({ id: m.recordId, name })}>
                    <UserMinus /> Remove
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {myRole === 'owner' ? (
        <ShareForm tripId={tripId} />
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Only the trip owner can invite people or change roles.</p>
      )}

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={removeMember}
        loading={busy}
        title="Remove member?"
        description={removing ? `${removing.name} will lose access to this trip right away. You can share it with them again later.` : undefined}
        confirmText="Remove member"
      />

      <dl className="mt-6 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
        {ROLE_HELP.map(([role, body]) => (
          <div key={role} className="rounded-lg bg-secondary p-3">
            <dt className="font-semibold capitalize">{role}</dt>
            <dd className="mt-0.5 text-muted-foreground">{body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const ROLE_HELP = [
  ['owner', 'Created the trip. Invites people and changes roles, plus everything an editor can do.'],
  ['editor', 'Generates the report, checks items, adds and assigns items, saves stops, uploads documents.'],
  ['viewer', 'Reads everything and downloads documents, but can’t change anything.'],
] as const

function ShareForm({ tripId }: { tripId: string }) {
  const { success, error } = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const result = await callAction('shareTrip', { tripId, email, role })
    setSubmitting(false)
    if (result.success) {
      success('Trip shared', `${email} is now a ${role}.`)
      setEmail('')
    } else {
      error('Could not share trip', result.error)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-2 border-t border-border pt-4">
      <Label htmlFor="share-email">Share with a BeforeMiles user</Label>
      <p className="text-xs text-muted-foreground">
        They need to have signed in to BeforeMiles once. Sharing again with the same email changes their role.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          id="share-email"
          type="email"
          required
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1"
        />
        <select
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <Button type="submit" disabled={submitting}>{submitting ? 'Sharing…' : 'Share'}</Button>
      </div>
    </form>
  )
}
