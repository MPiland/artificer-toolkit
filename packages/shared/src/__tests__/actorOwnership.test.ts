import { describe, expect, it } from 'vitest'
import {
  MAX_ACTOR_OWNER_DEPTH,
  actorOwnerChain,
  controlsActorOrOwner
} from '../domains/campaign/actorOwnership.js'

type Actor = { id: string; owner?: { ownerActorId: string } | undefined }

const world = (...actors: Actor[]) => {
  const byId = new Map(actors.map((actor) => [actor.id, actor]))
  return (id: string) => byId.get(id)
}
const owned = (id: string, ownerActorId: string): Actor => ({ id, owner: { ownerActorId } })

describe('actorOwnerChain', () => {
  it('lists the actor then its owners, nearest first', () => {
    const find = world({ id: 'pc' }, owned('summon', 'pc'), owned('minion', 'summon'))
    expect(actorOwnerChain(find('minion')!, find).map(({ id }) => id)).toEqual([
      'minion',
      'summon',
      'pc'
    ])
    expect(actorOwnerChain(find('pc')!, find).map(({ id }) => id)).toEqual(['pc'])
  })

  it('stops at an owner it cannot see, at a repeat and at the depth bound', () => {
    const missing = world(owned('summon', 'gone'))
    expect(actorOwnerChain(missing('summon')!, missing).map(({ id }) => id)).toEqual(['summon'])

    const loop = world(owned('a', 'b'), owned('b', 'a'))
    expect(actorOwnerChain(loop('a')!, loop).map(({ id }) => id)).toEqual(['a', 'b'])

    const long = Array.from({ length: MAX_ACTOR_OWNER_DEPTH + 3 }, (_, index) =>
      owned(`n${index}`, `n${index + 1}`)
    )
    const find = world(...long)
    expect(actorOwnerChain(find('n0')!, find)).toHaveLength(MAX_ACTOR_OWNER_DEPTH + 1)
  })
})

describe('controlsActorOrOwner', () => {
  it('holds when the actor or any owner passes, and not for an unowned stranger', () => {
    const find = world({ id: 'pc' }, owned('summon', 'pc'), { id: 'other' })
    const controls = (actor: Actor) => actor.id === 'pc'
    expect(controlsActorOrOwner(find('summon')!, find, controls)).toBe(true)
    expect(controlsActorOrOwner(find('pc')!, find, controls)).toBe(true)
    expect(controlsActorOrOwner(find('other')!, find, controls)).toBe(false)
  })
})
