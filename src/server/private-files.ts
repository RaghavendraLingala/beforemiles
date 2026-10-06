/**
 * Server-side access to a user's private ('self' scope) file, acting as that
 * user. The platform only lets a user touch keys under their own prefix and
 * trusts `x-user-id` solely alongside this app's signed identity — so callers
 * must authorize first (trip membership for reads, owner/editor for deletes)
 * and pass the uploader recorded on the document, never a client value.
 */

import { platformWorkerFetch } from 'deepspace/worker'
import { reassertAppIdentity } from './http-routes.js'
import type { Env } from '../../worker.js'

export function privateFileRequest(env: Env, fileKey: string, ownerUserId: string, method: 'GET' | 'DELETE') {
  const headers = new Headers()
  reassertAppIdentity(headers, env)
  headers.set('x-user-id', ownerUserId)
  const path = `/internal/files/${fileKey.split('/').map(encodeURIComponent).join('/')}?scope=self`
  return platformWorkerFetch(env, path, { method, headers })
}

/** Deletes a private file. A file that is already gone counts as deleted. */
export async function deletePrivateFile(env: Env, fileKey: string, ownerUserId: string): Promise<boolean> {
  const res = await privateFileRequest(env, fileKey, ownerUserId, 'DELETE')
  if (res.ok || res.status === 404) return true
  console.warn(`[private-files] delete failed status=${res.status}`)
  return false
}
