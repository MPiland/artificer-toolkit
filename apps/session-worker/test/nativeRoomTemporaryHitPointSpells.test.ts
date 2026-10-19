import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { SpellAuthored } from '@artificer-toolkit/shared'
import { SPELL_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { enhanceAbility } from '@artificer-toolkit/source-data/srd/spells/enhance-ability.js'
import { heroism } from '@artificer-toolkit/source-data/srd/spells/heroism.js'
import { regenerate } from '@artificer-toolkit/source-data/srd/spells/regenerate.js'
import { spellChildId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { endConcentrationAtSheet } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2t (D156): temporary hit points an effect gives belong to it and leave when it ends.
 * Heroism makes its willing target immune to the frightened condition and gives it temporary hit
 * points equal to the caster's spellcasting modifier at the start of each of its turns, for the
 * caster's Concentration.
 */

const CHARACTER_ACTOR_ID = testUuid(0x9d0)
const CHARACTER_ID = testUuid(0x9d1)
const ALLY_ID = testUuid(0x9d2)
const ACKNOWLEDGED = ['TARGET_RANGE_UNCHECKED' as const]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Character of `level` who knows `spell`, and an allied Wolf after it in the turn order (a sturdy
 * one of 40 hit points at `wolfHitPoints` when set), `rolls` as the dice (a raw die is its face
 * less one).
 */
function casterRoom(
  spell: SpellAuthored,
  label: string,
  config: { level?: number; wolfHitPoints?: number; rolls?: readonly number[] } = {}
) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({
        id: ALLY_ID,
        creature: config.wolfHitPoints === undefined ? plainWolf : { ...plainWolf, hitPoints: 40 },
        ...(config.wolfHitPoints !== undefined && { currentHitPoints: config.wolfHitPoints }),
        disposition: 'FRIENDLY'
      })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    ...(config.level && { characterPlay: { classLevel: config.level } }),
    // The cast's dice roll from `rolls` for whoever rolls them, else they wait for a manual roll.
    ...(config.rolls && { autoRoll: 'BOTH' as const, rolls: config.rolls, fallbackRoll: 0 }),
    characterAction: (action) => action.label === label
  })
}

type CasterRoom = Awaited<ReturnType<typeof casterRoom>>

async function allyVitals(room: CasterRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  const vitals = vitalsOf(history).find(({ id }) => id === ALLY_ID)
  if (!vitals) throw new Error('The room holds the allied Wolf.')
  return { ...vitals, history }
}

describe('room Heroism (SPELLS-4.T2t)', () => {
  it('gives its target temporary hit points each turn, which leave when the caster ends Concentration', async () => {
    const room = await casterRoom(heroism, 'Heroism (1st level)')

    const { answer } = await room.startAction(ALLY_ID, ACKNOWLEDGED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const cast = await allyVitals(room)
    // The recurring temporary hit points wait for the target's own turn; the effect holds now.
    expect(cast.tempHitPoints).toBe(0)
    expect(cast.history.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([ALLY_ID])

    await room.advanceTurn()
    // The fixture Character's spellcasting modifier is +1.
    expect((await allyVitals(room)).tempHitPoints).toBe(1)

    const ended = await endConcentrationAtSheet(room, CHARACTER_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    const after = await allyVitals(room)
    expect(after.tempHitPoints).toBe(0)
    expect(after.history.activeEffects).toEqual([])
  }, 120000)
})

describe("room Enhance Ability, Bear's Endurance (SPELLS-4.T2t)", () => {
  it('gives advantage and temporary hit points at cast, which leave when the caster ends Concentration', async () => {
    const room = await casterRoom(enhanceAbility, 'Enhance Ability (2nd level)', {
      level: 3,
      rolls: [2, 3]
    })

    const { answer } = await room.startAction(
      ALLY_ID,
      ACKNOWLEDGED,
      null,
      null,
      undefined,
      undefined,
      spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x220, 1)
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const cast = await allyVitals(room)
    // 2d6 rolled 3 and 4.
    expect(cast.tempHitPoints).toBe(7)
    expect(cast.history.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([ALLY_ID])

    const ended = await endConcentrationAtSheet(room, CHARACTER_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    const after = await allyVitals(room)
    expect(after.tempHitPoints).toBe(0)
    expect(after.history.activeEffects).toEqual([])
  }, 120000)
})

describe('room Regenerate (SPELLS-4.T2t)', () => {
  it('heals at cast, then 1 hit point at the start of each of its target turns, without Concentration', async () => {
    const room = await casterRoom(regenerate, 'Regenerate (7th level)', {
      level: 13,
      wolfHitPoints: 1,
      rolls: [0, 0, 0, 0]
    })

    const { answer } = await room.startAction(ALLY_ID, ACKNOWLEDGED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const cast = await allyVitals(room)
    // 4d8 + 15 rolled four 1s.
    expect(cast.currentHitPoints).toBe(20)
    expect(cast.history.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([ALLY_ID])

    await room.advanceTurn()
    expect((await allyVitals(room)).currentHitPoints).toBe(21)
  }, 120000)
})
