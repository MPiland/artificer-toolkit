import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/** An opportunity attack rolls with the sight its reactor and mover have of each other (ATTACK-10.4, D100). */

const MOVER_ID = testUuid(0x200)
const REACTOR_ID = testUuid(0x201)
const MOVER_START: ScenePoint = { x: 150, y: 150 }
const BLINDED_ID = srdSystemRecord.conditionTypes.find(({ code }) => code === 'BLINDED')?.id

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A FRIENDLY reaction Wolf beside a HOSTILE Wolf walking east; the GM's rolls are automatic. */
function reactionRoom(moverConditionIds: readonly string[]) {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf, conditionIds: moverConditionIds })
    ],
    moverActorId: MOVER_ID,
    positions: { [REACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
    autoRoll: 'GAME_MASTER',
    // The d20s roll a 1 then a 15; the bite dice land on their minimum.
    rolls: [0, 14, 0, 0],
    fallbackRoll: 0
  })
}

/** Walks the mover east, uses the one reaction offered and returns its attack d20. */
async function reactionAttackD20(room: Awaited<ReturnType<typeof reactionRoom>>) {
  await room.move([MOVER_START, { x: 450, y: 150 }])
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
  const receipt = (await room.receipts()).find((entry) => entry.commandId === used.commandId)
  if (!receipt) throw new Error('The reaction left no receipt.')
  const result = storedRuleExecutionResultDtoSchema.parse(receipt.result)
  if (
    result.status !== 'MOVEMENT_COMPLETE' &&
    !(result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new Error(`Expected a movement result, got ${result.status}.`)
  const { application } = result.reactionExecutions[0]!
  if (application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' || !application.d20)
    throw new Error('Expected a Creature reaction attack d20.')
  return application.d20
}

describe('an opportunity attack against a mover that cannot see its reactor', () => {
  it('rolls with advantage and keeps the higher die', async () => {
    const room = await reactionRoom(BLINDED_ID ? [BLINDED_ID] : [])
    const d20 = await reactionAttackD20(room)
    expect(d20).toMatchObject({ rollMode: 'ADVANTAGE', rawFaces: [1, 15], selectedNatural: 15 })
    // Two attack d20s and the two bite dice.
    expect(room.diceDrawn()).toBe(4)
  }, 60_000)

  it('rolls one die when the mover sees its reactor', async () => {
    const room = await reactionRoom([])
    const d20 = await reactionAttackD20(room)
    expect(d20).toMatchObject({ rollMode: 'NORMAL', rawFaces: [1], selectedNatural: 1 })
  }, 60_000)
})
