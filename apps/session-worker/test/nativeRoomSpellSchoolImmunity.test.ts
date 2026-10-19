import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { colorSpray } from '@artificer-toolkit/source-data/srd/spells/color-spray.js'
import { mindBlank } from '@artificer-toolkit/source-data/srd/spells/mind-blank.js'
import {
  SRD_MAGIC_SCHOOLS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory, readRoomTimeline } from './roomHistoryReads.js'

/**
 * SPELLS-33.T6m1: a creature holding SPELL_SCHOOL_IMMUNITY (Mind Blank's divination clause) is
 * caught by a spell of that school but unaffected by it; the rest of the spell resolves normally.
 */

const CHARACTER_ACTOR_ID = testUuid(0x8c0)
const CHARACTER_ID = testUuid(0x8c1)
const LOW_ID = testUuid(0x8c2)
const MID_ID = testUuid(0x8c3)

const blinded =
  srdSystemRecord.conditionTypes.find(({ code }) => code === 'BLINDED') ??
  (() => {
    throw new Error('The SRD vocabulary lacks Blinded.')
  })()
const divination =
  SRD_MAGIC_SCHOOLS.find(({ code }) => code === 'DIVINATION') ??
  (() => {
    throw new Error('The SRD vocabulary lacks Divination.')
  })()
const mindBlankEffect = mindBlank.effects?.[0]
if (!mindBlankEffect) throw new Error('The SRD Mind Blank must author its effect.')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const wolfAt = (id: string, hitPoints: number) =>
  srdCreatureActor({ id, creature: { ...plainWolf, hitPoints }, currentHitPoints: hitPoints })

/**
 * The Character sprays east over a 5 and a 9 hit-point Wolf; the pool of 14 reaches both. The 9
 * hit-point Wolf holds the real Mind Blank effect.
 */
function sprayRoom(spell: SpellAuthored) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      wolfAt(LOW_ID, 5),
      wolfAt(MID_ID, 9)
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label === 'Color Spray (1st level)',
    autoRoll: 'BOTH',
    rolls: [0, 0, 0, 0, 4, 4],
    fallbackRoll: 5,
    seed: seedModifierGrant({
      sourceActorId: MID_ID,
      holderActorId: MID_ID,
      lifecycle: {},
      effect: mindBlankEffect
    })
  })
}

async function blindAfterCast(spell: SpellAuthored) {
  const room = await sprayRoom(spell)
  const { answer } = await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const stored = await readRoomHistory(room.room.base.stub)
  return {
    room,
    blind: [LOW_ID, MID_ID].filter((id) => readActorConditionIds(stored, id).includes(blinded.id))
  }
}

describe('room spell against a Mind Blank holder (SPELLS-33.T6m1)', () => {
  it('leaves the holder unaffected by a divination spell, blinds the other creature, and tells the GM', async () => {
    const { room, blind } = await blindAfterCast({ ...colorSpray, magicSchoolId: divination.id })

    expect(blind).toEqual([LOW_ID])
    const gm = await readRoomTimeline(room.room.base.stub, {
      player: false,
      userId: room.room.base.userId
    })
    expect(gm.entries.find((entry) => entry.commandType === 'RESOLVE_ACTION')?.gmLines).toEqual([
      'Wolf was unaffected'
    ])
  }, 120000)

  it('still affects the holder with a spell of another school', async () => {
    const { blind } = await blindAfterCast(colorSpray)

    expect(blind).toEqual([LOW_ID, MID_ID])
  }, 120000)
})
