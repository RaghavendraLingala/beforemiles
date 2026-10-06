import { useState } from 'react'

/**
 * Optimistic on/off toggles backed by a server action.
 *
 * While an action is in flight, the row shows the value the user asked for
 * (`valueFor`) and its control is disabled (`isPending`). When the action
 * answers, the override is dropped and the row shows the live-synced value
 * again: the new value if the server accepted it, the old one if it refused.
 */
export function usePendingToggles() {
  const [pending, setPending] = useState<Record<string, boolean>>({})

  async function run<T>(id: string, value: boolean, task: () => Promise<T>): Promise<T> {
    setPending((prev) => ({ ...prev, [id]: value }))
    try {
      return await task()
    } finally {
      setPending(({ [id]: _done, ...rest }) => rest)
    }
  }

  return {
    isPending: (id: string) => id in pending,
    valueFor: (id: string, serverValue: boolean) => (id in pending ? pending[id] : serverValue),
    run,
  }
}

export function formatWhen(iso?: string): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
}
