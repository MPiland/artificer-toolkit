import { describe, expect, it } from 'vitest'
import { getSpell } from './queries'

describe('native Spell detail queries', () => {
  it('reads public aliases with distinct active and draft subscriptions and metadata', () => {
    const active = getSpell('spell-public-alias')
    const draft = getSpell({
      id: 'spell-public-alias',
      meta: ['classes', 'conditionTypes', 'damageTypes', 'magicSchools'],
      view: 'draft'
    })

    expect(active.queryKey).toEqual([
      'convexQuery',
      'content/details:get',
      { id: 'spell-public-alias', subjectKind: 'SPELL' }
    ])
    expect(draft.queryKey).not.toEqual(active.queryKey)
    expect(active.queryFn).toBeUndefined()
    expect(active.select?.(null)).toBeNull()
    expect(() => getSpell('')).toThrow()
  })
})
