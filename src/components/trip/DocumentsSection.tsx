import { useRef, useState, type FormEvent } from 'react'
import { formatFileSize, useQuery, useR2Files, useUserLookup } from 'deepspace'
import { Download, Lock, Trash2, Upload } from 'lucide-react'
import { Badge, Button, ConfirmModal, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { downloadTripDocument, tripDocumentKey } from '@/lib/documents'
import { formatWhen } from '@/lib/use-pending'
import {
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentType,
  type TripDocument,
} from '../../schemas/trip-documents-schema'

export function DocumentsSection({ tripId, canEdit }: { tripId: string; canEdit: boolean }) {
  const { records: documents } = useQuery<TripDocument>('trip_documents', {
    where: { tripId },
    orderBy: 'uploadedAt',
    orderDir: 'desc',
  })
  const { getUser } = useUserLookup()
  const { success, error } = useToast()
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function deleteDocument() {
    if (!deleting) return
    setBusy(true)
    const result = await callAction('deleteTripDocument', { documentId: deleting.id })
    setBusy(false)
    if (!result.success) {
      error('Could not delete document', result.error)
      return
    }
    success('Document deleted', deleting.name)
    setDeleting(null)
  }

  async function download(documentId: string, fileName: string) {
    try {
      await downloadTripDocument(documentId, fileName)
    } catch (err) {
      error('Could not open document', err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold">Documents</h2>
      <p className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" /> Private to this trip: only its members can open these files.
      </p>

      {canEdit && <UploadForm tripId={tripId} />}

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-border" data-testid="document-list">
          {documents.map(({ recordId, data }) => (
            <li key={recordId} data-record-id={recordId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{data.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  <Badge className="mr-2 capitalize">{data.documentType}</Badge>
                  {formatFileSize(data.size)} · {getUser(data.uploadedBy)?.name ?? 'a member'} ·{' '}
                  {formatWhen(data.uploadedAt)}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Download ${data.fileName}`}
                  onClick={() => download(recordId, data.fileName)}
                >
                  <Download /> Download
                </Button>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="size-9" aria-label={`Delete document: ${data.fileName}`}
                    title="Delete document" onClick={() => setDeleting({ id: recordId, name: data.fileName })}>
                    <Trash2 />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={deleteDocument}
        loading={busy}
        title="Delete document?"
        description={deleting ? `“${deleting.name}” will be deleted from this trip and from storage for everyone. This can’t be undone.` : undefined}
        confirmText="Delete document"
      />
    </section>
  )
}

function UploadForm({ tripId }: { tripId: string }) {
  const { upload, deleteFile } = useR2Files() // default 'self' scope: private to the uploader
  const { success, error } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [documentType, setDocumentType] = useState<DocumentType>('travel document')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const file = fileInput.current?.files?.[0]
    if (!file) return
    if (file.size > MAX_DOCUMENT_BYTES) {
      error('File too large', 'Documents must be 10 MB or smaller.')
      return
    }

    setBusy(true)
    try {
      const uploaded = await upload(file, file.name, { key: tripDocumentKey(tripId, file.name) })
      if (!uploaded.success || !uploaded.key) {
        error('Upload failed', uploaded.error)
        return
      }
      const added = await callAction('addTripDocument', {
        tripId,
        fileKey: uploaded.key,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        documentType,
      })
      if (!added.success) {
        await deleteFile(uploaded.key) // don't leave an unattached file behind
        error('Could not attach document', added.error)
        return
      }
      success('Document added', file.name)
      if (fileInput.current) fileInput.current.value = ''
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 space-y-2 rounded-md border border-dashed border-border p-4">
      <Label htmlFor="document-file">Add a document (max 10 MB)</Label>
      <div className="flex flex-wrap gap-2">
        <input
          id="document-file"
          ref={fileInput}
          type="file"
          required
          accept="image/*,application/pdf,text/plain,.doc,.docx"
          className="min-w-0 flex-1 text-sm"
        />
        <select
          aria-label="Document type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm capitalize text-foreground"
        >
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button type="submit" disabled={busy}>
          <Upload /> {busy ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </form>
  )
}
