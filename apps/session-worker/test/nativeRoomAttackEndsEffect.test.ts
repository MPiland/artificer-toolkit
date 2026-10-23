import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ActiveEffectEndTrigger } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { endTriggerEffectSeed, INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-27.T4b: an effect that ends when its holder attacks, or casts, against an enemy (Sanctuary)
 * ends, with the condition it alone held, in the commit of that action; an ally is not an enemy.
 */

const HOLDER_ID = testUuid(0x910)
const TARGET_ID = testUuid(0x911)
const EFFECT_ID = testUuid(0x5610)

const weapon = biteWolf('ATTACK')
/** The same Bite as a melee spell attack: the Creature's cast. */
const spellAttacker: CreatureAuthored = {
  ...weapon,
  features: weapon.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          effects: feature.effects?.map((effect) => {
            if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action effect.')
            return {
              ...effect,
              invocation: { ...effect.invocation, triggerCode: 'MELEE_SPELL_ATTACK' as const }
            }
          })
        }
  )
}

afterEach(() => {
  closeTrackedSockets()
})

/** The Holder, invisible by `trigger`, bites a Target who is its `enemy` or its ally. */
function attackRoom(input: {
  trigger: ActiveEffectEndTrigger
  creature: CreatureAuthored
  target: 'ENEMY' | 'ALLY'
}) {
  return actionRoom({
    actors: [
      srdCreatureActor({
        id: HOLDER_ID,
        creature: input.creature,
        conditionIds: [INVISIBLE_ID],
        disposition: 'FRIENDLY'
      }),
      srdCreatureActor({
        id: TARGET_ID,
        creature: plainWolf,
        disposition: input.target === 'ENEMY' ? 'HOSTILE' : 'FRIENDLY'
      })
    ],
    ownerFeatureId: creatureFeature(input.creature, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [14],
    fallbackRoll: 0,
    seed: endTriggerEffectSeed({
      effectId: EFFECT_ID,
      holderActorId: HOLDER_ID,
      sourceActorId: HOLDER_ID,
      triggers: [input.trigger]
    })
  })
}

async function held(room: Awaited<ReturnType<typeof attackRoom>>) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id),
    invisible: readActorConditionIds(history, HOLDER_ID).includes(INVISIBLE_ID)
  }
}

const ends = { effectIds: [], invisible: false }
const stays = { effectIds: [EFFECT_ID], invisible: true }
const attacksEnemy = { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' } as const
const castsAtEnemy = { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' } as const

describe('an effect that ends when its holder acts against an enemy (SPELLS-27.T4b)', () => {
  it.each([
    ['an attack roll against an enemy', attacksEnemy, weapon, 'ENEMY' as const, ends],
    ['an attack roll against an ally', attacksEnemy, weapon, 'ALLY' as const, stays],
    ['a spell attack against an enemy', castsAtEnemy, spellAttacker, 'ENEMY' as const, ends],
    ['a spell attack against an ally', castsAtEnemy, spellAttacker, 'ALLY' as const, stays],
    ['a weapon attack, for a cast trigger', castsAtEnemy, weapon, 'ENEMY' as const, stays]
  ])('%s', async (_label, trigger, creature, target, expected) => {
    const room = await attackRoom({ trigger, creature, target })
    expect(await held(room)).toEqual(stays)

    const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect(await held(room)).toEqual(expected)
  })

  it('gives the effect and its condition back when the action is undone', async () => {
    const room = await attackRoom({ trigger: attacksEnemy, creature: weapon, target: 'ENEMY' })
    await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
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
