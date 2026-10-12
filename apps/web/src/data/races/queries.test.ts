import { getFunctionName } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { getRace } from './queries'

const detailsGet = getFunctionName(api.content.details.get)

describe('native Race detail queries', () => {
  it('reads public aliases with distinct active and draft subscriptions and metadata', () => {
    const active = getRace('race-public-alias')
    const draft = getRace({ id: 'race-public-alias', meta: ['speeds'], view: 'draft' })

    expect(active.queryKey).toEqual([
      'convexQuery',
      detailsGet,
      { id: 'race-public-alias', subjectKind: 'RACE' }
    ])
    expect(draft.queryKey).toEqual([
      'convexQuery',
      detailsGet,
      { id: 'race-public-alias', meta: ['speeds'], subjectKind: 'RACE', view: 'draft' }
    ])
    expect(draft.queryKey).not.toEqual(active.queryKey)
    expect(active.queryFn).toBeUndefined()
    expect(active.select?.(null)).toBeNull()
    expect(() => getRace('')).toThrow()
  })
})
