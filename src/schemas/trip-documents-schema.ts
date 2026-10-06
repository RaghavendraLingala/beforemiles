/**
 * Trip documents — metadata for private files attached to a trip.
 *
 * The bytes live in the uploader's private ('self' scope) DeepSpace file
 * storage; this row records which file belongs to which trip. Members open a
 * file through GET /api/trip-documents/:id/file (src/server/document-routes.ts),
 * which checks trip membership before reading it as its uploader.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { tripTeamPermissions } from './trip-access'

export const DOCUMENT_TYPES = [
  'route screenshot',
  'booking',
  'ticket',
  'permit',
  'packing reference',
  'travel document',
  'other',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

/** Per-file cap; the owner's whole plan has a storage allocation too. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export type TripDocument = {
  tripId: string
  fileKey: string
  fileName: string
  mimeType: string
  size: number
  documentType: DocumentType
  uploadedBy: string
  uploadedAt: string
}

export const tripDocumentsSchema: CollectionSchema = {
  name: 'trip_documents',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'fileKey', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'fileName', storage: 'text', interpretation: 'plain', required: true },
    { name: 'mimeType', storage: 'text', interpretation: 'plain' },
    { name: 'size', storage: 'number', interpretation: 'plain' },
    { name: 'documentType', storage: 'text', interpretation: { kind: 'select', options: [...DOCUMENT_TYPES] } },
    { name: 'uploadedBy', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'uploadedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  uniqueOn: ['fileKey'],
  teamField: 'tripId',
  permissions: tripTeamPermissions,
}
