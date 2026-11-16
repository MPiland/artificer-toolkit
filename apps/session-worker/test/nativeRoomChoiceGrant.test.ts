import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { enhanceAbility } from '@artificer-toolkit/source-data/srd/spells/enhance-ability.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { choiceOptionIdOf } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3c: Enhance Ability's cast-time pick (D148) grants each option's own effect, so a
 * cast naming Bull's Strength commits one lasting Character effect on the touched creature.
 */

const CHARACTER_ACTOR_ID = testUuid(0x9c0)
const CHARACTER_ID = testUuid(0x9c1)
const WOLF_ID = testUuid(0x9c2)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('Enhance Ability in the room (QUALITY-15.T3c)', () => {
  it('commits the picked option as a lasting effect on the touched caster', async () => {
    const room = await actionRoom({
      actors: [
        {
          ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
          snapshot: { kind: 'CHARACTER' as const, id: CHARACTER_ID, systemId: srdSystemRecord.id }
        },
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf, disposition: 'HOSTILE' })
      ],
      characterSpellcasting: { spells: [enhanceAbility], prepared: [enhanceAbility.id] },
      characterAction: (action) => action.label.startsWith('Enhance Ability')
    })

    const { answer } = await room.startAction(
      CHARACTER_ACTOR_ID,
      ['TARGET_RANGE_UNCHECKED'],
      null,
      null,
      undefined,
      undefined,
      choiceOptionIdOf(enhanceAbility, "Bull's Strength")
    )

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { characterEffects } = await readRoomHistory(room.room.base.stub)
    expect(characterEffects).toHaveLength(1)
  })
})
