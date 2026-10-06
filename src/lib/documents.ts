import { authHeaders } from './actions'

/**
 * Upload key inside the uploader's private storage. addTripDocument requires
 * files to live under `trips/<tripId>/`, and the random prefix keeps two
 * uploads with the same name from replacing each other.
 */
export function tripDocumentKey(tripId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(-80) || 'file'
  return `trips/${tripId}/${crypto.randomUUID()}-${safeName}`
}

/** Fetches a trip document through the membership-checked route. */
export async function fetchTripDocument(documentId: string): Promise<Response> {
  return fetch(`/api/trip-documents/${encodeURIComponent(documentId)}/file`, { headers: await authHeaders() })
}

/** Downloads a trip document to the user's device. */
export async function downloadTripDocument(documentId: string, fileName: string): Promise<void> {
  const res = await fetchTripDocument(documentId)
  if (!res.ok) throw new Error(res.status === 404 ? 'Document not found.' : 'Could not open the document.')
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
