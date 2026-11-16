import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { phantasmalKiller } from '@artificer-toolkit/source-data/srd/spells/phantasmal-killer.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3z: the SRD Phantasmal Killer's holder repeats its Wisdom save at the end of each of
 * its turns. A failure deals the cast level's d10s of psychic damage and the effect holds; a success
 * ends the effect and the Frightened condition it owns.
 */

const HOLDER_ID = testUuid(0x9e0)
const CASTER_ID = testUuid(0x9e1)
const KILLER_EFFECT_ID = testUuid(0x9e2)

afterEach(() => {
  closeTrackedSockets()
})

const frightened = (() => {
  const condition = SRD_CONDITION_TYPES.find(({ code }) => code === 'FRIGHTENED')
  if (!condition) throw new Error('The SRD has no Frightened condition.')
  return condition.id
})()

/** The holder's turn, ended once, with every die (zero-based) rolling `face`. */
async function endHolderTurn(face: number, castLevel: number) {
  const room = await movementRoom({
    actors: [
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf, conditionIds: [frightened] }),
      srdCreatureActor({ id: CASTER_ID, creature: plainWolf })
    ],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 }, [CASTER_ID]: { x: 250, y: 150 } },
    autoRoll: 'GAME_MASTER',
    rolls: [],
    fallbackRoll: face,
    definitions: [],
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedTimedCondition({
        encounterId,
        sourceActorId: CASTER_ID,
        holderActorId: HOLDER_ID,
        spell: phantasmalKiller,
        lifetimeScope: 'ENCOUNTER',
        castLevel
      })
      await effects.create({
        id: KILLER_EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
  const before = await readRoomHistory(room.base.stub)
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'ADVANCE_TURN',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: before.runs[0]!.version
    }
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const hitPoints = (history: typeof before) =>
    vitalsOf(history).find(({ id }) => id === HOLDER_ID)?.currentHitPoints
  const after = await readRoomHistory(room.base.stub)
  return { before, after, lost: hitPoints(before)! - hitPoints(after)! }
}

describe('a room ADVANCE_TURN that ends a Phantasmal Killer holder’s turn', () => {
  it.each([
    { castLevel: 4, damage: 4 },
    { castLevel: 5, damage: 5 }
  ])(
    'deals $damage psychic damage on a failed save at cast level $castLevel and keeps the effect',
    async ({ castLevel, damage }) => {
      // A natural 1 fails the save; each d10 then rolls a 1.
      const { after, lost } = await endHolderTurn(0, castLevel)
      expect(lost).toBe(damage)
      expect(after.activeEffects.map(({ id }) => id)).toContain(KILLER_EFFECT_ID)
      expect(readActorConditionIds(after, HOLDER_ID)).toContain(frightened)
    }
  )

  it('ends the effect and Frightened on a made save, without damage', async () => {
    const { after, lost } = await endHolderTurn(19, 5)
    expect(lost).toBe(0)
    expect(after.activeEffects.map(({ id }) => id)).not.toContain(KILLER_EFFECT_ID)
    expect(readActorConditionIds(after, HOLDER_ID)).not.toContain(frightened)
  })
})
