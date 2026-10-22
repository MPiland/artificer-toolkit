import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { enthrall } from '@artificer-toolkit/source-data/srd/spells/enthrall.js'
import {
  SRD_PERCEPTION_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2k1 (D156): a creature that fails its Wisdom save against Enthrall holds disadvantage on
 * its Perception checks as an Encounter active effect; one that succeeds holds nothing.
 */

const CHARACTER_ACTOR_ID = testUuid(0xe10)
const CHARACTER_ID = testUuid(0xe11)
const FAILING_WOLF_ID = testUuid(0xe12)
const SAVING_WOLF_ID = testUuid(0xe13)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('room Enthrall (SPELLS-4.T2k1)', () => {
  it('gives only the Wolf that fails its save disadvantage on Perception', async () => {
    const room = await actionRoom({
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        srdCreatureActor({ id: FAILING_WOLF_ID, creature: biteWolf('ATTACK') }),
        srdCreatureActor({ id: SAVING_WOLF_ID, creature: biteWolf('ATTACK') })
      ],
      characterSpellcasting: { spells: [enthrall], prepared: [enthrall.id] },
      characterAction: (action) => action.label.startsWith(enthrall.label)
    })
    const cast = await room.startActorsAction(
      [FAILING_WOLF_ID, SAVING_WOLF_ID],
      ['TARGET_RANGE_UNCHECKED'],
      false
    )
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room, { [SAVING_WOLF_ID]: 20 })

    const { activeEffects } = await readRoomHistory(room.room.base.stub)
    expect(activeEffects.map((effect) => effect.targetActorId)).toEqual([FAILING_WOLF_ID])
    expect(JSON.parse(activeEffects[0]!.definitionJson)).toMatchObject({
      stateContributions: [
        {
          kind: 'MODIFIER_GRANT',
          modifiers: [
            {
              valueDomainCode: 'SKILL_MODIFIER',
              modifierKind: 'ROLL_INFLUENCE',
              payload: { influence: 'DISADVANTAGE' },
              domain: { skillId: SRD_PERCEPTION_SKILL_ID }
            }
          ]
        }
      ]
    })
  }, 120000)
})
