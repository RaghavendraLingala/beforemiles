/**
 * GET /api/trip-documents/:id/file — serves a trip document to trip members.
 *
 * Files are stored in each uploader's private ('self' scope) storage, which
 * the platform only lets that user read. This route is the trip-level gate:
 * it verifies the caller, checks they are an active member of the document's
 * trip (any role), and only then reads the file *as its uploader*. Nothing is
 * ever made public. addTripDocument guarantees the key lives in the
 * uploader's own folder for that trip, and the platform rejects a key outside
 * the x-user-id it is given, so this cannot be used to read other files.
 */

import type { Hono } from 'hono'
import { resolveSessionReadAuth } from 'deepspace/worker'
import type { VerifyResult } from 'deepspace/worker'
import { requireTripRole } from './trip-access.js'
import type { TripDocument } from '../schemas/trip-documents-schema.js'
import { createActionTools } from './action-routes.js'
import { privateFileRequest } from './private-files.js'
import type { AppContext, Env } from '../../worker.js'

type ResolveAuth = (req: Request, env: Env) => Promise<VerifyResult | null>

export function registerTripDocumentRoutes(app: Hono<AppContext>, resolveAuth: ResolveAuth): void {
  app.get('/api/trip-documents/:id/file', async (c) => {
    // Bearer for fetch(); the session cookie also works for a plain same-origin link.
    const auth = (await resolveAuth(c.req.raw, c.env)) ?? (await resolveSessionReadAuth(c.req.raw, c.env))
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)

    const tools = createActionTools(c.env, auth.userId, '')
    const doc = await tools.get<TripDocument>('trip_documents', c.req.param('id'))
    // Same answer for "missing" and "not yours", so ids can't be probed.
    if (!doc.success) return c.json({ error: 'not_found' }, 404)
    const { tripId, fileKey, fileName, uploadedBy } = doc.data.record.data
    const access = await requireTripRole(tools, tripId, auth.userId, 'viewer')
    if (!access.success) return c.json({ error: 'not_found' }, 404)

    const file = await privateFileRequest(c.env, fileKey, uploadedBy, 'GET')
    if (!file.ok) {
      console.warn(`[trip-documents] file read failed status=${file.status} doc=${c.req.param('id')}`)
      return c.json({ error: 'File unavailable' }, file.status === 404 ? 404 : 502)
    }

    return new Response(file.body, {
      headers: {
        'Content-Type': file.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
}
