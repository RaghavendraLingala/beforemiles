import { useState, type FormEvent } from 'react'
import { useQuery, useUserLookup } from 'deepspace'
import { ListChecks, Plus, Trash2, UserRound } from 'lucide-react'
import { Badge, Button, ConfirmModal, EmptyState, Input, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { formatWhen, usePendingToggles } from '@/lib/use-pending'
import {
  CHECKLIST_CATEGORIES,
  type ChecklistCategory,
  type ChecklistItem,
} from '../../schemas/checklist-items-schema'

const selectClass = 'h-10 rounded-lg border border-input bg-background px-3 text-sm capitalize text-foreground'

type SourceFilter = 'all' | 'ai' | 'manual'

export function ChecklistSection({ tripId, canEdit, onOpenReport }: {
  tripId: string
  canEdit: boolean
  onOpenReport: () => void
}) {
  const { records: items } = useQuery<ChecklistItem>('checklist_items', { where: { tripId }, orderBy: 'position' })
  const { getUser } = useUserLookup()
  const { error } = useToast()
  const { isPending, valueFor, run } = usePendingToggles()
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [deleting, setDeleting] = useState<{ id: string; text: string } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function deleteItem() {
    if (!deleting) return
    setDeleteBusy(true)
    const result = await callAction('deleteManualChecklistItem', { itemId: deleting.id })
    setDeleteBusy(false)
    if (!result.success) {
      error('Could not delete item', result.error)
      return
    }
    setDeleting(null)
  }
  const counts = {
    all: items.length,
    ai: items.filter((i) => i.data.source !== 'manual').length,
    manual: items.filter((i) => i.data.source === 'manual').length,
  }
  const visible = sourceFilter === 'all'
    ? items
    : items.filter((i) => (sourceFilter === 'manual' ? i.data.source === 'manual' : i.data.source !== 'manual'))

  const done = items.filter((i) => valueFor(i.recordId, !!i.data.checked)).length

  async function toggle(itemId: string, checked: boolean) {
    const result = await run(itemId, checked, () => callAction('setChecklistItemChecked', { itemId, checked }))
    if (!result.success) error('Could not update checklist', result.error)
  }

  if (items.length === 0 && !canEdit) {
    return (
      <section className="rounded-lg border border-border bg-card">
        <EmptyState
          icon={<ListChecks />}
          title="No checklist yet"
          description="The checklist is created with the Trip Readiness Report."
          action={{ label: 'Go to Report', onClick: onOpenReport }}
        />
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Before-you-leave checklist</h2>
        {items.length > 0 && <span className="text-sm text-muted-foreground">{done} of {items.length} done</span>}
      </div>
      {!canEdit && <p className="mb-4 text-xs text-muted-foreground">You have view access, so the checklist is read-only.</p>}

      {canEdit && <AddItemForm tripId={tripId} />}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add your own items above, or{' '}
          <button type="button" onClick={onOpenReport} className="text-primary underline-offset-4 hover:underline">
            generate a report
          </button>{' '}
          for AI suggestions.
        </p>
      ) : (
        <div className="space-y-4">
          {counts.ai > 0 && counts.manual > 0 && (
            <div role="group" aria-label="Filter by source" className="inline-flex rounded-lg bg-muted p-1 text-sm">
              {([
                ['all', 'All'],
                ['ai', 'AI-suggested'],
                ['manual', 'Added manually'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sourceFilter === value}
                  onClick={() => setSourceFilter(value)}
                  className={
                    sourceFilter === value
                      ? 'rounded-md bg-background px-3 py-1.5 font-medium text-foreground shadow-sm'
                      : 'rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'
                  }
                >
                  {label} <span className="text-xs text-muted-foreground">{counts[value]}</span>
                </button>
              ))}
            </div>
          )}
          {CHECKLIST_CATEGORIES.map((category) => {
            const inCategory = visible.filter((i) => i.data.category === category)
            if (inCategory.length === 0) return null
            return (
              <div key={category}>
                <h3 className="mb-1 text-sm font-semibold capitalize">{category}</h3>
                <ul className="space-y-2">
                  {inCategory.map(({ recordId, data }) => (
                    <ChecklistRow
                      key={recordId}
                      recordId={recordId}
                      item={data}
                      checked={valueFor(recordId, !!data.checked)}
                      canEdit={canEdit}
                      disabled={!canEdit || isPending(recordId)}
                      checkedByName={data.checkedBy ? (getUser(data.checkedBy)?.name ?? 'a member') : undefined}
                      onToggle={(value) => toggle(recordId, value)}
                      onDelete={canEdit && data.source === 'manual' ? () => setDeleting({ id: recordId, text: data.text }) : undefined}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={deleteItem}
        loading={deleteBusy}
        title="Delete item?"
        description={deleting ? `“${deleting.text}” will be removed from the checklist for everyone.` : undefined}
        confirmText="Delete item"
      />
    </section>
  )
}

function AddItemForm({ tripId }: { tripId: string }) {
  const { error } = useToast()
  const [text, setText] = useState('')
  const [category, setCategory] = useState<ChecklistCategory>('packing')
  const [assignedToName, setAssignedToName] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const result = await callAction('addManualChecklistItem', { tripId, text, category, assignedToName })
    setBusy(false)
    if (!result.success) {
      error('Could not add item', result.error)
      return
    }
    setText('')
    setAssignedToName('')
  }

  return (
    <form onSubmit={onSubmit} className="mb-5 flex flex-wrap gap-2 rounded-md border border-dashed border-border p-3">
      <Input
        aria-label="New checklist item"
        placeholder="Add an item, e.g. Book the dog sitter"
        value={text}
        maxLength={200}
        required
        onChange={(e) => setText(e.target.value)}
        className="min-w-48 flex-[2]"
      />
      <select
        aria-label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value as ChecklistCategory)}
        className={selectClass}
      >
        {CHECKLIST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <Input
        aria-label="Assign to (optional)"
        placeholder="Assign to (optional)"
        value={assignedToName}
        maxLength={60}
        onChange={(e) => setAssignedToName(e.target.value)}
        className="min-w-32 flex-1"
      />
      <Button type="submit" disabled={busy || !text.trim()}>
        <Plus /> {busy ? 'Adding…' : 'Add item'}
      </Button>
    </form>
  )
}

function ChecklistRow({ recordId, item, checked, canEdit, disabled, checkedByName, onToggle, onDelete }: {
  recordId: string
  item: ChecklistItem
  checked: boolean
  canEdit: boolean
  disabled: boolean
  checkedByName?: string
  onToggle: (checked: boolean) => void
  /** Manual items only, for owners/editors. */
  onDelete?: () => void
}) {
  return (
    <li data-record-id={recordId}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <label className="flex flex-1 items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className={checked ? 'text-muted-foreground line-through' : ''}>{item.text}</span>
          {item.source === 'manual' && <Badge size="sm" className="shrink-0">Manual</Badge>}
        </label>
        <Assignment recordId={recordId} item={item} canEdit={canEdit} />
        {onDelete && (
          <button
            type="button"
            aria-label={`Delete item: ${item.text}`}
            title="Delete item"
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {/* Attribution shows once the server has confirmed the check. */}
      {checked && item.checked && checkedByName && (
        <p className="ml-6 text-xs text-muted-foreground">
          Checked by {checkedByName} · {formatWhen(item.checkedAt)}
        </p>
      )}
    </li>
  )
}

/** Who an item is assigned to: plain text for viewers, inline edit for owners/editors. */
function Assignment({ recordId, item, canEdit }: { recordId: string; item: ChecklistItem; canEdit: boolean }) {
  const { error } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const assignee = item.assignedToName ?? ''

  if (!canEdit) {
    return assignee ? <AssigneeLabel name={assignee} /> : null
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Assign: ${item.text}`}
        onClick={() => {
          setDraft(assignee)
          setEditing(true)
        }}
        className="rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {assignee ? <AssigneeLabel name={assignee} /> : '+ Assign'}
      </button>
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const result = await callAction('updateChecklistItemAssignment', { itemId: recordId, assignedToName: draft })
    setBusy(false)
    if (result.success) setEditing(false)
    else error('Could not update assignment', result.error)
  }

  return (
    <form onSubmit={save} className="flex items-center gap-1">
      <Input
        autoFocus
        aria-label={`Assignee for: ${item.text}`}
        placeholder="Name (empty to clear)"
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        className="h-8 w-40 text-xs"
      />
      <Button type="submit" size="sm" disabled={busy}>Save</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
    </form>
  )
}

function AssigneeLabel({ name }: { name: string }) {
  return (
    <span data-testid="assignee" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <UserRound className="size-3" /> {name}
    </span>
  )
}
