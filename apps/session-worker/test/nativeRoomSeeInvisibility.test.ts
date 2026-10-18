import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { seeInvisibility } from '@artificer-toolkit/source-data/srd/spells/see-invisibility.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { INVISIBLE_ID } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2a4 (D156): See Invisibility grants its caster a sense that perceives invisible
 * creatures, so the caster's attack on an Invisible creature loses the disadvantage of an unseen
 * target.
 */

const CHARACTER_ACTOR_ID = testUuid(0x7e0)
const CHARACTER_ID = testUuid(0x7e1)
const WOLF_ID = testUuid(0x7e2)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Character with a Club and See Invisibility prepared, beside an Invisible hostile Wolf. */
const seeInvisibilityRoom = () =>
  actionRoom({
    actors: [
      // A turn change reads the Character's frozen identity.
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({
        id: WOLF_ID,
        creature: plainWolf,
        conditionIds: [INVISIBLE_ID],
        disposition: 'HOSTILE'
      })
    ],
    characterPlay: { equipped: true },
    characterSpellcasting: { spells: [seeInvisibility], prepared: [seeInvisibility.id] },
    characterAction: (action) => action.label.startsWith('See Invisibility')
  })

type Room = Awaited<ReturnType<typeof seeInvisibilityRoom>>

/** The mode of the d20 the room asks for when the Character swings its Club at the Wolf. */
async function clubRollMode(room: Room) {
  const club = (await room.actionChoices()).actions.find(({ label }) => label.includes('Club'))
  if (!club) throw new Error('The Character offers no Club attack.')
  const { answer } = await room.startAction(
    WOLF_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    club.id
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const prompt = await room.pendingDecision()
  if (prompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
  return prompt.pending.request.rollMode
}

describe('See Invisibility in the room (SPELLS-4.T2a4)', () => {
  it('attacks an Invisible creature with disadvantage without the spell', async () => {
    expect(await clubRollMode(await seeInvisibilityRoom())).toBe('DISADVANTAGE')
  })

  it('grants the caster the sense for an hour, and its next attack on the Invisible Wolf rolls normally', async () => {
    const room = await seeInvisibilityRoom()
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const [effect] = (await readRoomHistory(room.room.base.stub)).characterEffects
    expect(effect).toBeDefined()

    // The Wolf's turn passes and the Character's next turn opens, its action restored.
    await room.advanceTurn()
    await room.advanceTurn()

    expect(await clubRollMode(room)).toBe('NORMAL')
  })
})
