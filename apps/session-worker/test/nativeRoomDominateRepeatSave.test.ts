import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { dominateBeast } from '@artificer-toolkit/source-data/srd/spells/dominate-beast.js'
import { dominateMonster } from '@artificer-toolkit/source-data/srd/spells/dominate-monster.js'
import { dominatePerson } from '@artificer-toolkit/source-data/srd/spells/dominate-person.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0x830)
const HOLDER_ID = testUuid(0x831)
const CASTER_ID = testUuid(0x832)
const DOMINATE_EFFECT_ID = testUuid(0x5330)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const effectIds = (history: RoomHistory) => history.activeEffects.map((effect) => effect.id)

/** The repeat-save check outputs, one per check the Run settled. */
function repeatSaveChecks(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [execution.applicationOutputs]
      : []
  })
}

/**
 * A Wolf bites another Wolf, which holds the Charmed condition of a domination spell cast by a third
 * (the condition the real cast compiler plans from the authored spell): the damage owes the holder
 * a repeat save, answered by the GM, and a made save ends the condition (QUALITY-15.T3k).
 */
async function biteTheDominated(spell: typeof dominatePerson, face: number) {
  const attacker = biteWolf('ATTACK')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf }),
      srdCreatureActor({ id: CASTER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedTimedCondition({
        encounterId,
        sourceActorId: CASTER_ID,
        holderActorId: HOLDER_ID,
        spell,
        lifetimeScope: 'ENCOUNTER'
      })
      await effects.create({
        id: DOMINATE_EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
  const before = await readRoomHistory(room.room.base.stub)
  expect(effectIds(before)).toContain(DOMINATE_EFFECT_ID)
  const { answer } = await room.startAction(HOLDER_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  // Nobody auto-rolls: the GM enters the attack die (a hit), then the holder's save die.
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected an attack roll.')
  await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId: attack.pending.request.requestId,
    rawFaces: [19],
    rollMode: attack.pending.request.rollMode
  })
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a repeat save.')
  expect(decision.pending).toMatchObject({
    rollerActorId: HOLDER_ID,
    request: { min: 1, max: 20 }
  })
  expect(repeatSaveChecks(await readRoomHistory(room.room.base.stub))).toEqual([])
  const { request } = decision.pending
  const resolved = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: Array.from({ length: request.rollMode === 'NORMAL' ? 1 : 2 }, () => face),
    rollMode: request.rollMode
  })
  expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
  return { room, before, after: await readRoomHistory(room.room.base.stub) }
}

describe.each([
  ['Dominate Person', dominatePerson],
  ['Dominate Beast', dominateBeast],
  ['Dominate Monster', dominateMonster]
])('room %s damage repeat save (QUALITY-15.T3k)', (_label, spell) => {
  it('ends the held Charmed condition on a made save and bumps the Run version', async () => {
    const { room, before, after } = await biteTheDominated(spell, 20)
    expect(repeatSaveChecks(after)).toMatchObject([{ outcome: 'SAVE_SUCCESS' }])
    expect(effectIds(after)).not.toContain(DOMINATE_EFFECT_ID)
    expect(after.runs[0]!.version).toBeGreaterThan(before.runs[0]!.version)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('keeps the held Charmed condition on a failed save', async () => {
    const { room, after } = await biteTheDominated(spell, 1)
    expect(repeatSaveChecks(after)).toMatchObject([{ outcome: 'SAVE_FAILURE' }])
    expect(effectIds(after)).toContain(DOMINATE_EFFECT_ID)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})
