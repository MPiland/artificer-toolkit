import { describe, expect, it } from 'vitest'
import { getRace } from './queries'

describe('native Race detail queries', () => {
  it('reads public aliases with distinct active and draft subscriptions and metadata', () => {
    const active = getRace('race-public-alias')
    const draft = getRace({ id: 'race-public-alias', meta: ['speeds'], view: 'draft' })

    expect(active.queryKey).toEqual([
      'convexQuery',
      'content/details:get',
      { id: 'race-public-alias', subjectKind: 'RACE' }
    ])
    expect(draft.queryKey).toEqual([
      'convexQuery',
      'content/details:get',
      { id: 'race-public-alias', meta: ['speeds'], subjectKind: 'RACE', view: 'draft' }
    ])
    expect(draft.queryKey).not.toEqual(active.queryKey)
    expect(active.queryFn).toBeUndefined()
    expect(active.select?.(null)).toBeNull()
    expect(() => getRace('')).toThrow()
  })
})
