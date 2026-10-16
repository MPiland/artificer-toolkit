import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ActiveEffectEndTrigger } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { endTriggerEffectSeed, INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-27.T4b: an area that damages a caught creature ends the damage-triggered effects it holds,
 * with the condition each alone held, in that creature's commit; the area's undo gives both back.
 */

const CASTER_ID = testUuid(0x940)
const HOLDER_ID = testUuid(0x941)
const COMPANION_ID = testUuid(0x942)
const FOE_ID = testUuid(0x943)
const EFFECT_ID = testUuid(0x5640)
const anyone = { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null } as const
const fromSourceSide = { event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null } as const

afterEach(() => {
  closeTrackedSockets()
})

/** The Holder is invisible; the Caster's area catches the Holder, the Companion and the Foe. */
function areaDamageRoom(input: {
  trigger: ActiveEffectEndTrigger
  effectSource: 'CASTER' | 'FOE'
}) {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf, conditionIds: [INVISIBLE_ID] }),
      srdCreatureActor({ id: COMPANION_ID, creature: plainWolf }),
      srdCreatureActor({ id: FOE_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    ],
    ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id,
    seed: endTriggerEffectSeed({
      effectId: EFFECT_ID,
      holderActorId: HOLDER_ID,
      sourceActorId: input.effectSource === 'CASTER' ? CASTER_ID : FOE_ID,
      triggers: [input.trigger]
    })
  })
}

type Room = Awaited<ReturnType<typeof areaDamageRoom>>

async function held(room: Room) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id),
    invisible: readActorConditionIds(history, HOLDER_ID).includes(INVISIBLE_ID)
  }
}

const ends = { effectIds: [], invisible: false }
const stays = { effectIds: [EFFECT_ID], invisible: true }

async function cast(room: Room, faces: Record<string, number> = {}) {
  await room.startAreaAction({ x: 50, y: 150 })
  await answerAllSaves(room, faces)
}

describe('an area that damages the holder of a damage-triggered effect (SPELLS-27.T4b)', () => {
  it.each([
    ['anyone’s damage', { trigger: anyone, effectSource: 'CASTER' as const }, ends],
    ['the caster’s own damage', { trigger: fromSourceSide, effectSource: 'CASTER' as const }, ends],
    [
      'damage from an enemy of the source',
      { trigger: fromSourceSide, effectSource: 'FOE' as const },
      stays
    ]
  ])('%s', async (_label, config, expected) => {
    const room = await areaDamageRoom(config)
    expect(await held(room)).toEqual(stays)

    await cast(room)

    expect(await held(room)).toEqual(expected)
  })

  it('keeps the effect when the holder’s save spares it from the damage', async () => {
    const room = await areaDamageRoom({ trigger: anyone, effectSource: 'CASTER' })

    await cast(room, { [HOLDER_ID]: 20 })

    expect(await held(room)).toEqual(stays)
  })

  it('gives the effect and its condition back when the area is undone', async () => {
    const room = await areaDamageRoom({ trigger: anyone, effectSource: 'CASTER' })
    await cast(room)
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
