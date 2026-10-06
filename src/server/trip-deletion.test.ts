import { describe, expect, it, vi } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { deleteTripAndData, type DeleteFile } from './trip-deletion'

type Row = Record<string, unknown>

/**
 * In-memory stand-in for the action tools (records.* over a Durable Object).
 * `failNext('remove', 'trips')` makes the next matching call fail once — an
 * injected interruption.
 */
function fakeTools(seed: Record<string, Record<string, Row>>) {
  const db = new Map(Object.entries(seed).map(([c, rows]) => [c, new Map(Object.entries(rows))]))
  const failures = new Set<string>()
  const table = (c: string) => db.get(c) ?? db.set(c, new Map()).get(c)!
  const matches = (row: Row, where: Row = {}) => Object.entries(where).every(([k, v]) => row[k] === v)
  const injected = (op: string, c: string, id = '') => {
    for (const key of [`${op}:${c}:${id}`, `${op}:${c}`]) {
      if (failures.delete(key)) return { success: false as const, error: `injected failure: ${key}` }
    }
    return null
  }

  const tools = {
    async query(c: string, opts: { where?: Row; limit?: number } = {}) {
      const records = [...table(c)].filter(([, d]) => matches(d, opts.where))
        .slice(0, opts.limit ?? 500).map(([recordId, data]) => ({ recordId, data }))
      return { success: true, data: { records, count: records.length } }
    },
    async get(c: string, id: string) {
      const data = table(c).get(id)
      return data ? { success: true, data: { record: { recordId: id, data } } } : { success: false, error: 'Record not found' }
    },
    async remove(c: string, id: string) {
      const fail = injected('remove', c, id)
      if (fail) return fail
      if (!table(c).delete(id)) return { success: false, error: 'Record not found' }
      return { success: true, data: { recordId: id } }
    },
    async deleteWhere(c: string, where: Row, limit = 100) {
      const fail = injected('deleteWhere', c)
      if (fail) return fail
      const ids = [...table(c)].filter(([, d]) => matches(d, where)).slice(0, limit).map(([id]) => id)
      ids.forEach((id) => table(c).delete(id))
      return { success: true, data: { deleted: ids.length } }
    },
  } as unknown as ActionTools

  return {
    tools,
    failNext: (op: 'remove' | 'deleteWhere', c: string, id = '') => failures.add(id ? `${op}:${c}:${id}` : `${op}:${c}`),
    ids: (c: string) => [...table(c).keys()].sort(),
  }
}

/** Two trips: t1 (owner A, editor B, two documents) and t2 (owner A, one document). */
function twoTrips() {
  return fakeTools({
    trips: { t1: { tripId: 't1' }, t2: { tripId: 't2' } },
    team_members: {
      m1: { TeamId: 't1', UserId: 'A', Role: 'owner', Status: 'active' },
      m2: { TeamId: 't1', UserId: 'B', Role: 'editor', Status: 'active' },
      m3: { TeamId: 't2', UserId: 'A', Role: 'owner', Status: 'active' },
    },
    trip_documents: {
      d1: { tripId: 't1', fileKey: 'k/t1/a.txt', uploadedBy: 'A' },
      d2: { tripId: 't1', fileKey: 'k/t1/b.txt', uploadedBy: 'B' },
      d3: { tripId: 't2', fileKey: 'k/t2/c.txt', uploadedBy: 'A' },
    },
    checklist_items: { c1: { tripId: 't1' }, c2: { tripId: 't2' } },
    itinerary_items: { i1: { tripId: 't1' } },
    reports: { t1: { tripId: 't1' } },
  })
}

const filesGone: DeleteFile = async () => true

describe('deleteTripAndData', () => {
  it('deletes one trip and everything attached to it, leaving other trips untouched', async () => {
    const { tools, ids } = twoTrips()
    const deleteFile = vi.fn(filesGone)
    expect(await deleteTripAndData(tools, 't1', 'A', deleteFile)).toMatchObject({ success: true })

    expect(deleteFile.mock.calls.map(([key]) => key).sort()).toEqual(['k/t1/a.txt', 'k/t1/b.txt'])
    expect(ids('trips')).toEqual(['t2'])
    expect(ids('team_members')).toEqual(['m3'])
    expect(ids('trip_documents')).toEqual(['d3'])
    expect(ids('checklist_items')).toEqual(['c2'])
    expect(ids('itinerary_items')).toEqual([])
    expect(ids('reports')).toEqual([])
  })

  it('refuses non-owners, before touching anything', async () => {
    const { tools, ids } = twoTrips()
    const deleteFile = vi.fn(filesGone)
    expect(await deleteTripAndData(tools, 't1', 'B', deleteFile)).toMatchObject({ success: false, error: expect.stringMatching(/permission/) })
    expect(await deleteTripAndData(tools, 't1', 'stranger', deleteFile)).toMatchObject({ success: false })
    expect(deleteFile).not.toHaveBeenCalled()
    expect(ids('trip_documents')).toEqual(['d1', 'd2', 'd3'])
  })

  it('keeps the metadata of a file that could not be deleted, stops, and finishes on retry', async () => {
    const { tools, ids } = twoTrips()
    // Storage refuses b.txt the first time.
    const flaky: DeleteFile = async (key) => key !== 'k/t1/b.txt'
    const first = await deleteTripAndData(tools, 't1', 'A', flaky)
    expect(first).toMatchObject({ success: false, error: expect.stringMatching(/1 document file/) })
    // a.txt's metadata is gone with its file; b.txt's metadata is kept for the retry; nothing else touched.
    expect(ids('trip_documents')).toEqual(['d2', 'd3'])
    expect(ids('trips')).toEqual(['t1', 't2'])
    expect(ids('checklist_items')).toEqual(['c1', 'c2'])
    expect(ids('team_members')).toEqual(['m1', 'm2', 'm3'])

    const retryFile = vi.fn(filesGone)
    expect(await deleteTripAndData(tools, 't1', 'A', retryFile)).toMatchObject({ success: true })
    expect(retryFile.mock.calls.map(([key]) => key)).toEqual(['k/t1/b.txt'])
    expect(ids('trips')).toEqual(['t2'])
    expect(ids('team_members')).toEqual(['m3'])
  })

  it('resumes after an interruption once the trip record is already gone', async () => {
    const { tools, failNext, ids } = twoTrips()
    failNext('remove', 'team_members', 'm2') // dies right after removing the trip record
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: false })
    expect(ids('trips')).toEqual(['t2'])
    expect(ids('team_members')).toEqual(['m1', 'm2', 'm3']) // owner row kept → still authorized

    // Retry: the missing trip record is skipped, not treated as an error.
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: true })
    expect(ids('team_members')).toEqual(['m3'])
  })

  it('removes the owner membership last, so an interruption there is still retryable', async () => {
    const { tools, failNext, ids } = twoTrips()
    failNext('remove', 'team_members', 'm1')
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: false })
    expect(ids('team_members')).toEqual(['m1', 'm3'])
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: true })
    expect(ids('team_members')).toEqual(['m3'])
  })

  it('resumes after a child-record failure', async () => {
    const { tools, failNext, ids } = twoTrips()
    failNext('deleteWhere', 'itinerary_items')
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: false })
    expect(ids('trips')).toEqual(['t1', 't2'])
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: true })
    expect(ids('itinerary_items')).toEqual([])
  })

  it('keeps checking authorization after a completed delete (nothing is bypassed)', async () => {
    const { tools } = twoTrips()
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: true })
    expect(await deleteTripAndData(tools, 't1', 'A', filesGone)).toMatchObject({ success: false, error: expect.stringMatching(/permission/) })
  })
})
