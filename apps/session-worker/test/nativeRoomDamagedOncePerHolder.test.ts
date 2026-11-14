import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { scorchingRay } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-14.T2e: a creature a command damages several times (rays, darts, beams named at it again)
 * is damaged once by that command, so the hooks its one DAMAGED(AFTER) raise meets fire once.
 */

const CHARACTER_ACTOR_ID = testUuid(0xe70)
const CHARACTER_ID = testUuid(0xe71)
const TWICE_HIT_ID = testUuid(0xe72)
const ONCE_HIT_ID = testUuid(0xe73)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf with the Flesh Golem's Aversion of Fire, which grants disadvantage after fire damage. */
const aversionWolf: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0xe74),
  hitPoints: 40,
  features: [
    ...(plainWolf.features ?? []),
    creatureFeature(srdByLabel(SRD.creatures, 'Flesh Golem'), 'Aversion of Fire')
  ]
}

describe('a creature a command damages several times (QUALITY-14.T2e)', () => {
  it('takes the grant its passive fire trigger owes once from two Scorching Ray hits', async () => {
    // Each ray in turn rolls its attack and then its 2d6 (a raw die is its face less one): a hit
    // for 1 and 2, a hit for 1 and 2, then a hit for 1 and 2 at the other Wolf.
    const room = await actionRoom({
      actors: [
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        ...[TWICE_HIT_ID, ONCE_HIT_ID].map((id) =>
          srdCreatureActor({ id, creature: aversionWolf, currentHitPoints: 40 })
        )
      ],
      characterSpellcasting: { spells: [scorchingRay], prepared: [scorchingRay.id] },
      characterPlay: { currentHitPoints: 1 },
      characterAction: (action) => action.label === 'Scorching Ray (2nd level)',
      rolls: [18, 0, 1, 18, 0, 1, 18, 0, 1],
      fallbackRoll: 5,
      autoRoll: 'BOTH'
    })

    const { answer } = await room.startActorsAction(
      [TWICE_HIT_ID, TWICE_HIT_ID, ONCE_HIT_ID],
      [],
      true
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    const { children } = areaReceipts(history)
    // Every ray hit and burned: the creature named twice took both rays' fire.
    expect(children.map(({ outputs }) => outputs.targetActorId)).toEqual([
      TWICE_HIT_ID,
      TWICE_HIT_ID,
      ONCE_HIT_ID
    ])
    const hitPoints = Object.fromEntries(
      vitalsOf(history).map((actor) => [actor.id, actor.currentHitPoints])
    )
    expect(hitPoints).toMatchObject({ [TWICE_HIT_ID]: 40 - 3 - 3, [ONCE_HIT_ID]: 40 - 3 })
    const grantsOn = (actorId: string) =>
      history.activeEffects.filter(({ targetActorId }) => targetActorId === actorId)
    expect(grantsOn(TWICE_HIT_ID)).toHaveLength(1)
    expect(grantsOn(ONCE_HIT_ID)).toHaveLength(1)
  }, 120000)
})
