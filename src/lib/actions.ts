import { getAuthToken } from 'deepspace'

export type ActionResponse<T> = { success: true; data: T } | { success: false; error: string }

/** Authorization header for same-origin API calls as the signed-in user. */
export async function authHeaders(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getAuthToken()}` }
}

/** Calls a server action from src/actions/index.ts as the signed-in user. */
export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<ActionResponse<T>> {
  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(params),
    })
    const body = (await res.json()) as ActionResponse<T> | { error?: string }
    if ('success' in body) return body
    return { success: false, error: body.error ?? `Request failed (${res.status})` }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
