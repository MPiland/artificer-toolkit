import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { telepathicBond } from '@artificer-toolkit/source-data/srd/spells/telepathic-bond.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CHARACTER_ACTOR_ID = testUuid(0x8b0)
const CHARACTER_ID = testUuid(0x8b1)
const WOLF_IDS = [0x8b2, 0x8b3].map(testUuid)
const DULL_ID = testUuid(0x8b4)
const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const TOO_DULL: EncounterRuleWarningCodeDto[] = [
  'TARGET_ABILITY_EXCLUDED',
  'TARGET_RANGE_UNCHECKED'
]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const bondRoom = () =>
  actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      ...WOLF_IDS.map((id) =>
        srdCreatureActor({ id, creature: plainWolf, disposition: 'FRIENDLY' })
      ),
      srdCreatureActor({
        id: DULL_ID,
        disposition: 'FRIENDLY',
        creature: { ...plainWolf, abilityScores: { ...plainWolf.abilityScores, INTELLIGENCE: 2 } }
      })
    ],
    characterSpellcasting: { spells: [telepathicBond], prepared: [telepathicBond.id] },
    characterAction: (action) => action.label.startsWith(telepathicBond.label),
    rolls: [],
    fallbackRoll: 5
  })

const commit = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

describe('Telepathic Bond bonds the chosen creatures (SPELLS-28.1)', () => {
  it('leaves each chosen creature one bond naming all of them, and undoes them together', async () => {
    const room = await bondRoom()
    const chosen = [CHARACTER_ACTOR_ID, ...WOLF_IDS]

    commit((await room.startActorsAction(chosen, RANGE_UNCHECKED, false)).answer)
    const { activeEffects, characterEffects } = await readRoomHistory(room.room.base.stub)
    expect(activeEffects.map((effect) => effect.targetActorId).sort()).toEqual([...WOLF_IDS].sort())
    expect(characterEffects).toHaveLength(1)
    for (const effect of [...activeEffects, ...characterEffects]) {
      const { stateContributions } = JSON.parse(effect.definitionJson)
      expect(stateContributions).toEqual([
        expect.objectContaining({
          kind: 'ACTOR_LINK',
          linkKind: 'TELEPATHIC',
          memberActorIds: [...chosen].sort()
        })
      ])
    }

    commit(
      await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
    )
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.activeEffects).toHaveLength(0)
    expect(reverted.characterEffects).toHaveLength(0)
  }, 120000)

  it('warns, overridably, for a creature too dull to join the bond', async () => {
    const room = await bondRoom()
    const chosen = [CHARACTER_ACTOR_ID, WOLF_IDS[0]!, DULL_ID]

    const refused = await room.startActorsAction(chosen, RANGE_UNCHECKED, false)
    expect(refused.answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'RULE_WARNINGS',
      // Both warnings, whichever the room evaluates first.
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: 'TARGET_ABILITY_EXCLUDED' }),
        expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })
      ])
    })
    expect(refused.answer).toMatchObject({ warnings: { length: 2 } })
    commit((await room.startActorsAction(chosen, TOO_DULL, false)).answer)
  }, 120000)
})
