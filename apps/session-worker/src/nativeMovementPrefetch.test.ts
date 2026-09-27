import { describe, expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionMovementPrefetch } from '@artificer-toolkit/schema/api/liveSessionMovementAnswer'
import { MovementPrefetches } from './nativeMovementPrefetch.js'

const encounterId = crypto.randomUUID()
const occurrenceId = crypto.randomUUID()
const [owner, player] = [crypto.randomUUID(), crypto.randomUUID()]

function answer(
  resolution: ResolveRuleOccurrenceInputDto['resolution'] = { kind: 'DECLINE' }
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId,
    expectedVersion: 4,
    occurrenceId,
    expectedOccurrenceVersion: 1,
    correlationId: null,
    resolution
  }
}

function prefetch(userId: string): LiveSessionMovementPrefetch {
  return {
    expectedVersion: 4,
    movement: {
      encounterId,
      baseTokenOrdinal: 0,
      subject: {
        kind: 'DECISION',
        occurrenceId,
        occurrenceVersion: 1,
        encounterVersion: 4,
        appRoll: null
      }
    },
    bundle: { encounter: [], system: null, inputs: null, characters: [] },
    checksum: userId.replaceAll('-', '').padEnd(64, '0')
  }
}

describe('MovementPrefetches (D64)', () => {
  it('hands each member only their own read, once, for exactly the issued decision', async () => {
    const prefetches = new MovementPrefetches()
    prefetches.issue(occurrenceId, [
      { userId: owner, read: async () => prefetch(owner) },
      { userId: player, read: () => Promise.reject(new Error('NOT_ACTOR_CONTROLLER')) }
    ])
    // A member Convex refused holds nothing; another decision's answer takes nothing.
    expect(await prefetches.take(player, answer())).toBeNull()
    expect(
      await prefetches.take(owner, { ...answer(), occurrenceId: crypto.randomUUID() })
    ).toBeNull()
    expect(await prefetches.take(owner, answer())).toEqual(prefetch(owner))
    // Taken once: a refused answer falls back to the stage.
    expect(await prefetches.take(owner, answer())).toBeNull()
  })

  it('takes nothing for an answer at other versions or settled by an app roll', async () => {
    const prefetches = new MovementPrefetches()
    const issue = () =>
      prefetches.issue(occurrenceId, [{ userId: owner, read: async () => prefetch(owner) }])
    issue()
    expect(await prefetches.take(owner, { ...answer(), expectedVersion: 5 })).toBeNull()
    issue()
    expect(await prefetches.take(owner, { ...answer(), expectedOccurrenceVersion: 2 })).toBeNull()
    issue()
    expect(
      await prefetches.take(
        owner,
        answer({ kind: 'SYSTEM_ROLL', requestId: 'attack', rollId: crypto.randomUUID() })
      )
    ).toBeNull()
  })

  it('forgets an earlier decision when a new one is issued or the room clears it', async () => {
    const prefetches = new MovementPrefetches()
    prefetches.issue(occurrenceId, [{ userId: owner, read: async () => prefetch(owner) }])
    prefetches.issue(crypto.randomUUID(), [{ userId: owner, read: async () => prefetch(owner) }])
    expect(await prefetches.take(owner, answer())).toBeNull()
    prefetches.issue(occurrenceId, [{ userId: owner, read: async () => prefetch(owner) }])
    prefetches.clear()
    expect(await prefetches.take(owner, answer())).toBeNull()
  })
})
