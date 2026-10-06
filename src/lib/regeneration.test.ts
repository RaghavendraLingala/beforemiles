import { describe, expect, it } from 'vitest'
import { planRegeneration } from './regeneration'

const item = (recordId: string, text: string, checked = false, source = 'ai', assignedToName = '') => ({
  recordId,
  data: { text, checked, source, assignedToName },
})
const stop = (recordId: string, title: string, saved = false) => ({ recordId, data: { title, saved } })

describe('planRegeneration', () => {
  it('keeps checked items and replaces unchecked AI items', () => {
    const plan = planRegeneration(
      [item('a', 'Pack a first-aid kit', true), item('b', 'Download offline maps')],
      [],
      [{ text: 'Charge your power bank' }],
      [],
    )
    expect(plan.removeItemIds).toEqual(['b'])
    expect(plan.createItems).toEqual([{ text: 'Charge your power bank' }])
  })

  it('does not re-add a suggestion that matches a kept item, ignoring case and punctuation', () => {
    const plan = planRegeneration(
      [item('a', 'Pack a first-aid kit.', true)],
      [],
      [{ text: 'pack a first aid kit' }, { text: 'Check tire pressure' }],
      [],
    )
    expect(plan.removeItemIds).toEqual([])
    expect(plan.createItems).toEqual([{ text: 'Check tire pressure' }])
  })

  it('never removes manual items, even unchecked', () => {
    const plan = planRegeneration([item('m', 'Book the dog sitter', false, 'manual', 'Sam')], [], [], [])
    expect(plan.removeItemIds).toEqual([])
  })

  it('keeps an unchecked AI item that has been assigned to someone', () => {
    const plan = planRegeneration(
      [item('a', 'Refill prescriptions', false, 'ai', 'Mom'), item('b', 'Wash the car')],
      [],
      [{ text: 'Refill prescriptions' }, { text: 'Print tickets' }],
      [],
    )
    expect(plan.removeItemIds).toEqual(['b'])
    expect(plan.createItems).toEqual([{ text: 'Print tickets' }])
  })

  it('keeps saved stops, replaces unsaved ones, and skips duplicates of saved stops', () => {
    const plan = planRegeneration(
      [],
      [stop('s1', 'Rest area near Carmel', true), stop('s2', 'Scenic overlook')],
      [],
      [{ title: 'Rest area near Carmel' }, { title: 'EV charging in Monterey' }],
    )
    expect(plan.removeStopIds).toEqual(['s2'])
    expect(plan.createStops).toEqual([{ title: 'EV charging in Monterey' }])
  })
})
