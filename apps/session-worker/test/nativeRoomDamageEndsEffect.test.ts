import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ActiveEffectEndTrigger } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { endTriggerEffectSeed, INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-27.T4: an effect with a damage-taken end trigger ends, with the condition it alone held,
 * in the commit of the action that damages its holder; the GM's undo gives both back.
 */

const ATTACKER_ID = testUuid(0x900)
const HOLDER_ID = testUuid(0x901)
const SOURCE_ID = testUuid(0x902)
const EFFECT_ID = testUuid(0x5600)
const FIRE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id
/** A Wolf whose Bite hits for 3 damage of the SRD's type. */
const attacker = biteWolf('ATTACK', { damage: 3 })

afterEach(() => {
  closeTrackedSockets()
})

/**
 * Invisibility on the Holder, cast by a Source that is `sourceSide` the Attacker's side, ending on
 * `trigger`; the Attacker's Bite rolls `attackRoll` against the Holder.
 */
function damageRoom(input: {
  trigger: ActiveEffectEndTrigger
  sourceSide: 'ATTACKER' | 'ALLY' | 'ENEMY'
  attackRoll?: number
}) {
  const sourceActorId = input.sourceSide === 'ATTACKER' ? ATTACKER_ID : SOURCE_ID
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf, conditionIds: [INVISIBLE_ID] }),
      srdCreatureActor({
        id: SOURCE_ID,
        creature: plainWolf,
        disposition: input.sourceSide === 'ENEMY' ? 'FRIENDLY' : 'HOSTILE'
      })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    autoRoll: 'BOTH',
    // An invisible target is attacked with disadvantage: two d20s, both the same.
    rolls: [input.attackRoll ?? 14, input.attackRoll ?? 14],
    fallbackRoll: 0,
    seed: endTriggerEffectSeed({
      effectId: EFFECT_ID,
      holderActorId: HOLDER_ID,
      sourceActorId,
      triggers: [input.trigger]
    })
  })
}

type Room = Awaited<ReturnType<typeof damageRoom>>

async function held(room: Room) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id),
    invisible: readActorConditionIds(history, HOLDER_ID).includes(INVISIBLE_ID)
  }
}

async function bite(room: Room) {
  const { answer } = await room.startAction(HOLDER_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

const ends = { effectIds: [], invisible: false }
const stays = { effectIds: [EFFECT_ID], invisible: true }
const anyone = { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null } as const
const fromSourceSide = { event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null } as const

describe('an effect that ends when its holder takes damage (SPELLS-27.T4)', () => {
  it.each([
    ['anyone’s damage', { trigger: anyone, sourceSide: 'ENEMY' as const }, ends],
    ['the source’s own damage', { trigger: fromSourceSide, sourceSide: 'ATTACKER' as const }, ends],
    ['an ally of the source', { trigger: fromSourceSide, sourceSide: 'ALLY' as const }, ends],
    [
      'a damage that misses',
      { trigger: anyone, sourceSide: 'ENEMY' as const, attackRoll: 1 },
      stays
    ],
    ['an enemy of the source', { trigger: fromSourceSide, sourceSide: 'ENEMY' as const }, stays],
    [
      'a damage type the trigger does not name',
      { trigger: { ...anyone, damageTypeIds: [FIRE_ID] }, sourceSide: 'ENEMY' as const },
      stays
    ]
  ])('%s', async (_label, config, expected) => {
    const room = await damageRoom(config)
    expect(await held(room)).toEqual(stays)

    await bite(room)

    expect(await held(room)).toEqual(expected)
  })

  it('gives the effect and its condition back when the action is undone', async () => {
    const room = await damageRoom({ trigger: anyone, sourceSide: 'ENEMY' })
    await bite(room)
    expect(await held(room)).toEqual(ends)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })

    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await held(room)).toEqual(stays)
  })
})
