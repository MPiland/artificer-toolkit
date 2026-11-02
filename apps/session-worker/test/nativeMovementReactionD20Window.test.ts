import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, saveStopWolf } from '../src/testing/movementPlannerFixture.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4c1b4b: the save a movement reaction makes the mover roll pauses in a d20 window when the
 * mover holds an after-the-roll die (D168, D203). The window is the mover's to answer and the spent die
 * ends with the reaction.
 */

const MOVER_ID = testUuid(0x960)
const REACTOR_ID = testUuid(0x961)
const DIE_ID = testUuid(0x962)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
})

/** The Wolf walking east holds Resistance's die when the friendly Wolf's Bite makes it save. */
function holdingRoom() {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: REACTOR_ID, creature: saveStopWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf })
    ],
    moverActorId: MOVER_ID,
    positions: { [REACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
    autoRoll: 'BOTH',
    // Every die rolls its minimum: the DC 30 save fails with or without the die.
    fallbackRoll: 0,
    seed: seedModifierGrant({
      sourceActorId: MOVER_ID,
      holderActorId: MOVER_ID,
      lifecycle: {},
      effect: heldSaveDieEffect(),
      sourceLabel: resistance.label,
      id: DIE_ID
    })
  })
}
type Room = Awaited<ReturnType<typeof holdingRoom>>

/** Walks into the reaction, uses it, and returns the mover's open window. */
async function openWindow(room: Room) {
  await room.move([MOVER_START, { x: 450, y: 150 }])
  const choice = await room.pending()
  if (choice?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${choice?.context.kind}.`)
  const option = choice.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  const window = await room.pending()
  if (
    window?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    window.context.phase.kind !== 'ACTION_EVIDENCE' ||
    window.context.phase.pause?.kind !== 'ROLL_WINDOW'
  )
    throw new Error('Expected the mover to hold a d20 window on the reaction save.')
  const shown = await room.pendingFor(false)
  if (shown?.kind !== 'ROLL_WINDOW') throw new Error(`Expected a d20 window, got ${shown?.kind}.`)
  return { phase: window.context.phase, pause: window.context.phase.pause, shown }
}

const heldDieIds = async (room: Room) =>
  (await readRoomHistory(room.base.stub)).activeEffects.map(({ id }) => id)

async function reactionOf(room: Room, commandId: string) {
  const receipt = (await room.receipts()).find((entry) => entry.commandId === commandId)
  if (!receipt) throw new Error('The window answer left no receipt.')
  const result = storedRuleExecutionResultDtoSchema.parse(receipt.result)
  if (result.status !== 'MOVEMENT_COMPLETE') throw new Error(`Got ${result.status}.`)
  const [reaction] = result.reactionExecutions
  if (!reaction || reaction.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
    throw new Error('Expected a Creature movement reaction target.')
  return { result, reaction, application: reaction.application }
}

describe('a movement-reaction save with a held after-the-roll die (SPELLS-31.T4c1b4b)', () => {
  it('spends the die the mover chooses and ends it with the reaction', async () => {
    const room = await holdingRoom()
    const { phase, pause, shown } = await openWindow(room)
    expect(phase.rollerActorId).toBe(MOVER_ID)
    expect(shown.rollerActorId).toBe(MOVER_ID)

    const answered = await room.respond({
      kind: 'ROLL_WINDOW_USE',
      requestId: shown.requestId,
      optionId: pause.payload.offer.options[0]!.optionId,
      faces: [4]
    })
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')

    const { application, result } = await reactionOf(room, answered.commandId)
    // The settled d20 is the minimum face plus the die, and the failed save stops the walk.
    expect(application.d20?.addedDice?.map(({ spentEffectId }) => spentEffectId)).toEqual([DIE_ID])
    expect(application.d20?.total).toBe(
      (application.d20?.selectedNatural ?? 0) + (application.d20?.modifier ?? 0) + 4
    )
    expect(result.terminalPosition).toEqual({ x: 200, y: 150 })
    expect(await heldDieIds(room)).not.toContain(DIE_ID)
  }, 60_000)

  it('keeps the die when the mover declines', async () => {
    const room = await holdingRoom()
    const { shown } = await openWindow(room)

    const answered = await room.respond({ kind: 'ROLL_WINDOW_DECLINE', requestId: shown.requestId })
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')

    const { application } = await reactionOf(room, answered.commandId)
    expect(application.d20?.addedDice).toBeUndefined()
    expect(await heldDieIds(room)).toContain(DIE_ID)
  }, 60_000)
})
