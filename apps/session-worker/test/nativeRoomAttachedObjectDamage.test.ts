import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { alchemistsFireFlask } from '@artificer-toolkit/source-data/srd/equipment/alchemists-fire-flask.js'
import { acidArrow } from '@artificer-toolkit/source-data/srd/spells/acid-arrow.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3t2: an object a hit attaches to its target deals its damage at the target's turn
 * boundary. Acid Arrow's lingering acid deals the cast level's d4s at the end of the target's next
 * turn, once; Alchemist's Fire burns at the start of each of the target's turns until the target
 * spends its Action on the authored Dexterity check that puts it out.
 */

const CHARACTER_ACTOR_ID = testUuid(0x3d20)
const CHARACTER_ID = testUuid(0x3d21)
const WOLF_ID = testUuid(0x3d22)
const RANGE_UNCHECKED = ['TARGET_RANGE_UNCHECKED' as const]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A 5th-level Character, first in the order, that hits the Wolf beside it with `actionLabel`; `rolls`
 * are the dice in turn (a raw die is its face less one) and every later die shows its lowest face.
 */
async function hitWolf(
  config: Pick<ActionRoomConfig, 'characterSpellcasting' | 'characterEquipment'> & {
    actionLabel: string
    rolls: readonly number[]
  }
) {
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    ...(config.characterSpellcasting && { characterSpellcasting: config.characterSpellcasting }),
    ...(config.characterEquipment && { characterEquipment: config.characterEquipment }),
    characterPlay: { classLevel: 5 },
    autoRoll: 'BOTH',
    rolls: config.rolls,
    fallbackRoll: 0,
    characterAction: (action) => action.label === config.actionLabel
  })
  const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return room
}

type Room = Awaited<ReturnType<typeof hitWolf>>

/** The Wolf's current hit points and the ids of the effects it holds. */
async function wolfState(room: Room) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    hitPoints: vitalsOf(history).find(({ id }) => id === WOLF_ID)?.currentHitPoints,
    effectIds: history.activeEffects
      .filter(({ targetActorId }) => targetActorId === WOLF_ID)
      .map(({ id }) => id)
  }
}

describe('an attached object that deals damage at its holder’s turn boundary, in the room', () => {
  it('Acid Arrow cast at 3rd level burns the Wolf for 3d4 at the end of its next turn, once', async () => {
    // The spell attack hits; every damage die then rolls a 1.
    const room = await hitWolf({
      characterSpellcasting: { spells: [acidArrow], prepared: [acidArrow.id] },
      actionLabel: `${acidArrow.label} (3rd level)`,
      rolls: [15]
    })
    const hit = await wolfState(room)
    expect(hit.hitPoints).toBeLessThan(plainWolf.hitPoints)
    expect(hit.effectIds).toHaveLength(1)

    // The Wolf's turn starts: the acid waits for its end.
    await room.advanceTurn()
    expect(await wolfState(room)).toEqual(hit)

    // The Wolf's turn ends: the acid deals the 3rd-level 3d4 frozen at the cast, and is spent.
    await room.advanceTurn()
    expect(await wolfState(room)).toEqual({ hitPoints: hit.hitPoints! - 3, effectIds: [] })

    // A round later, nothing more burns.
    await room.advanceTurn()
    await room.advanceTurn()
    expect((await wolfState(room)).hitPoints).toBe(hit.hitPoints! - 3)
  }, 120000)

  it("Alchemist's Fire burns the Wolf at the start of each of its turns until it puts the flames out", async () => {
    // The thrown flask hits; each 1d4 then rolls a 1, and the Wolf's Dexterity check rolls a 20.
    const room = await hitWolf({
      characterEquipment: [alchemistsFireFlask],
      actionLabel: alchemistsFireFlask.label,
      rolls: [15, 0, 0, 19]
    })
    const hit = await wolfState(room)
    expect(hit.hitPoints).toBe(plainWolf.hitPoints)
    const [effectId, ...others] = hit.effectIds
    expect(others).toEqual([])
    if (!effectId) throw new Error('The hit attached no burning flask.')

    // Each of the Wolf's turns starts with 1 fire damage.
    await room.advanceTurn()
    expect(await wolfState(room)).toEqual({ hitPoints: hit.hitPoints! - 1, effectIds: [effectId] })
    await room.advanceTurn()
    await room.advanceTurn()
    expect(await wolfState(room)).toEqual({ hitPoints: hit.hitPoints! - 2, effectIds: [effectId] })

    // On its turn the Wolf is offered the authored DC 10 Dexterity check, and makes it.
    expect((await room.actionChoices(WOLF_ID)).escapes).toMatchObject([
      {
        activeEffectId: effectId,
        dc: 10,
        actionCost: 'ACTION',
        checks: [{ checkDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY }]
      }
    ])
    const escaped = await room.send({
      type: 'ESCAPE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: WOLF_ID,
      activeEffectId: effectId,
      checkDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
      acknowledgedWarnings: []
    })
    expect(escaped.type, JSON.stringify(escaped)).toBe('COMMAND_COMMITTED')
    expect(await wolfState(room)).toEqual({ hitPoints: hit.hitPoints! - 2, effectIds: [] })

    // Its next turn starts with no fire.
    await room.advanceTurn()
    await room.advanceTurn()
    expect((await wolfState(room)).hitPoints).toBe(hit.hitPoints! - 2)
  }, 120000)
})
