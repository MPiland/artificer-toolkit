import { getFunctionName } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { getCreature } from './queries'

describe('native Creature detail queries', () => {
  it('reads public aliases with distinct active and draft subscriptions and metadata', () => {
    const active = getCreature('creature-public-alias')
    const draft = getCreature({
      id: 'creature-public-alias',
      meta: [
        'challengeRatings',
        'conditionTypes',
        'creatureTypes',
        'damageTypes',
        'equipment',
        'speeds'
      ],
      view: 'draft'
    })

    expect(active.queryKey).toEqual([
      'convexQuery',
      getFunctionName(api.content.details.get),
      { id: 'creature-public-alias', subjectKind: 'CREATURE' }
    ])
    expect(draft.queryKey).not.toEqual(active.queryKey)
    expect(active.queryFn).toBeUndefined()
    expect(active.select?.(null)).toBeNull()
    expect(() => getCreature('')).toThrow()
  })
})
