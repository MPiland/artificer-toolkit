import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { incapacitatingReactionWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { CONCENTRATION_STATE_ID, movementRoom } from './movementRoomFixture.js'
import { readRoomChatBodies } from './roomHistoryReads.js'

/**
 * D95 on the movement paths: a holder a contact defeats or leaves unable to act loses
 * Concentration with no check, and later contacts of the same move roll nothing for it.
 */

const MOVER_ID = testUuid(0x200)
const REACTOR_ID = testUuid(0x201)
const CHARACTER_ID = testUuid(0x400)

const MOVER_START: ScenePoint = { x: 150, y: 150 }
const hazard = { center: { x: 350, y: 150 }, radius: 50 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

async function receiptsOf(room: Room, commandType: string) {
  return (await room.receipts()).filter((entry) => entry.commandType === commandType)
}

function holderRoom(config: Partial<Parameters<typeof movementRoom>[0]> = {}) {
  return movementRoom({
    actors: [characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: MOVER_START },
    autoRoll: 'PLAYER',
    concentration: true,
    concentrationDependentActorIds: [MOVER_ID],
    characterPlay: { currentHitPoints: 1 },
    ...config
  })
}

describe('movement-path Concentration ends (D95)', () => {
  it('ends Concentration with no check when a spatial effect drops the holder to 0 hit points', async () => {
    const room = await holderRoom({ spatialEffects: [hazard] })

    await room.move([MOVER_START, { x: 550, y: 150 }])

    expect(await receiptsOf(room, 'DAMAGE_SAVE_CHECK')).toHaveLength(0)
    const ends = await receiptsOf(room, 'CONCENTRATION_END')
    expect(ends).toHaveLength(1)
    expect(ends[0]?.result).toMatchObject({
      applicationOutputs: {
        kind: 'CONCENTRATION_END',
        ownerActorId: MOVER_ID,
        maintainedStateId: CONCENTRATION_STATE_ID,
        cleanup: { maintainedStateId: CONCENTRATION_STATE_ID }
      }
    })
    // The damage rolls no dice, and no save is rolled for the lost Concentration.
    expect(room.diceDrawn()).toBe(0)
    // The table is told once; the Character's player controls it, so the entry is public.
    expect(await readRoomChatBodies(room.base.stub)).toEqual([
      expect.stringMatching(/loses Concentration\.$/)
    ])
  })

  it('rolls no check for a later contact once the first contact ended Concentration', async () => {
    // A holder dropped to 0 stops moving (D156), so the first contact incapacitates it instead:
    // Incapacitated still lets it walk on into the second hazard.
    const incapacitated = SRD_CONDITION_TYPES.find((type) => type.code === 'INCAPACITATED')
    if (!incapacitated) throw new Error('The SRD INCAPACITATED condition is missing.')
    const room = await holderRoom({
      characterPlay: { currentHitPoints: 20 },
      spatialEffects: [
        { ...hazard, condition: { conditionId: incapacitated.id } },
        { center: { x: 500, y: 150 }, radius: 20, variant: 1 }
      ]
    })

    await room.move([MOVER_START, { x: 650, y: 150 }])

    expect(await receiptsOf(room, 'DAMAGE_SAVE_CHECK')).toHaveLength(0)
    expect(await receiptsOf(room, 'CONCENTRATION_END')).toHaveLength(1)
    expect(room.diceDrawn()).toBe(0)
    // Both hazards acted on the holder; only the first contact carries the end.
    const [move] = await receiptsOf(room, 'MOVE_SCENE_TOKEN')
    const { executions } = move!.result as { executions: object[] }
    expect(executions).toHaveLength(2)
    expect(executions[0]).toHaveProperty('concentrationEnd')
    expect(executions[1]).not.toHaveProperty('concentrationEnd')
    expect(executions[1]).not.toHaveProperty('concentrationChecks')
  })

  it('ends Concentration with no check when an opportunity attack drops the holder to 0', async () => {
    const room = await holderRoom({
      actors: [
        srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf }),
        characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
      ],
      positions: { [REACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
      autoRoll: 'BOTH',
      // The attack is a 15 and every other die rolls its minimum, so the bite still deals damage.
      rolls: [14],
      fallbackRoll: 0
    })

    await room.move([MOVER_START, { x: 450, y: 150 }])
    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
    const option = pending.context.reactionTimeline[0]?.group.options[0]
    if (!option) throw new Error('The reaction decision offers no option.')
    await room.respond({ kind: 'OPTION', optionId: option.optionId })

    expect(await receiptsOf(room, 'DAMAGE_SAVE_CHECK')).toHaveLength(0)
    expect(await receiptsOf(room, 'CONCENTRATION_END')).toHaveLength(1)
    // Only the reaction's attack d20 and bite dice are rolled; no save follows.
    expect(room.diceDrawn()).toBe(3)
  })

  it.each(['PARALYZED', 'STUNNED'] as const)(
    'ends Concentration with no check when a spatial effect leaves the holder %s',
    async (code) => {
      const condition = SRD_CONDITION_TYPES.find((type) => type.code === code)
      if (!condition) throw new Error(`The SRD ${code} condition is missing.`)
      const room = await holderRoom({
        characterPlay: { currentHitPoints: 20 },
        spatialEffects: [{ ...hazard, condition: { conditionId: condition.id } }]
      })

      await room.move([MOVER_START, { x: 550, y: 150 }])

      expect(await receiptsOf(room, 'DAMAGE_SAVE_CHECK')).toHaveLength(0)
      const ends = await receiptsOf(room, 'CONCENTRATION_END')
      expect(ends).toHaveLength(1)
      expect(ends[0]?.result).toMatchObject({
        applicationOutputs: { reason: 'INCAPACITATED', ownerActorId: MOVER_ID }
      })
      expect(room.diceDrawn()).toBe(0)
      expect(await readRoomChatBodies(room.base.stub)).toEqual([
        expect.stringMatching(/loses Concentration.$/)
      ])
    }
  )

  it("ends Concentration when a reaction leaves a state effect that suppresses the holder's actions", async () => {
    const room = await holderRoom({
      actors: [
        srdCreatureActor({ id: REACTOR_ID, creature: incapacitatingReactionWolf }),
        characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
      ],
      positions: { [REACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
      characterPlay: { currentHitPoints: 20 },
      autoRoll: 'BOTH',
      rolls: [14],
      fallbackRoll: 0
    })

    await room.move([MOVER_START, { x: 450, y: 150 }])
    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
    const option = pending.context.reactionTimeline[0]?.group.options[0]
    if (!option) throw new Error('The reaction decision offers no option.')
    await room.respond({ kind: 'OPTION', optionId: option.optionId })

    expect(await receiptsOf(room, 'DAMAGE_SAVE_CHECK')).toHaveLength(0)
    const ends = await receiptsOf(room, 'CONCENTRATION_END')
    expect(ends).toHaveLength(1)
    expect(ends[0]?.result).toMatchObject({
      applicationOutputs: { reason: 'INCAPACITATED', ownerActorId: MOVER_ID }
    })
  })

  it('ends nothing in a MANUAL Run', async () => {
    const room = await holderRoom({ automationMode: 'MANUAL', spatialEffects: [hazard] })

    await room.move([MOVER_START, { x: 550, y: 150 }])

    expect(await receiptsOf(room, 'CONCENTRATION_END')).toHaveLength(0)
  })
})
