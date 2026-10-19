import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { reactionWeapon } from './reactionClubFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-33.T6e3b: an opportunity attack that damages the mover gives it the timed grant its
 * passive damage trigger owes, in the same commit as the damage.
 */

const FIGHTER_ACTOR_ID = testUuid(0x6e50)
const FIGHTER_ID = testUuid(0x6e51)
const WOLF_ID = testUuid(0x6e52)
const WOLF_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf with the Flesh Golem's Aversion of Fire, which grants disadvantage after fire damage. */
const aversionWolf: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0x6e53),
  features: [
    ...(plainWolf.features ?? []),
    creatureFeature(srdByLabel(SRD.creatures, 'Flesh Golem'), 'Aversion of Fire')
  ]
}

/** The Wolf walks out of the Fighter's reach; the Fighter's opportunity attack hits for `damageTypeCode`. */
async function opportunityAttack(damageTypeCode: string) {
  const room = await movementRoom({
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: aversionWolf })
    ],
    moverActorId: WOLF_ID,
    positions: { [FIGHTER_ACTOR_ID]: { x: 50, y: 150 }, [WOLF_ID]: WOLF_START },
    autoRoll: 'BOTH',
    characterEquipment: [reactionWeapon(damageTypeCode)],
    rolls: [18],
    fallbackRoll: 0
  })
  const moved = await room.move([WOLF_START, { x: 450, y: 150 }])
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  return (await readRoomHistory(room.base.stub)).activeEffects
}

describe('an opportunity attack against a creature with a passive damage trigger (SPELLS-33.T6e3b)', () => {
  it('gives the mover its grant from the fire the attack dealt', async () => {
    const effects = await opportunityAttack('FIRE')

    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({ targetActorId: WOLF_ID })
  }, 60_000)

  it('gives the mover nothing for damage of another type', async () => {
    expect(await opportunityAttack('BLUDGEONING')).toEqual([])
  }, 60_000)
})
