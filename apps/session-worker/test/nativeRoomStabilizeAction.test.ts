import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { healersKit } from '@artificer-toolkit/source-data/srd/equipment/healers-kit.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xe00)
const FIGHTER_ID = testUuid(0xe01)
const WOLF_ID = testUuid(0xe02)
const kitCharges = healersKit.charges
if (kitCharges?.limitKind !== 'FIXED_AMOUNT' || kitCharges.scalingKind !== 'NONE')
  throw new Error('The SRD kit has fixed charges.')
const CHARGES = kitCharges.amount
/** The kit's touch range cannot be checked in a room without a Scene. */
const TOUCH_WITHOUT_SCENE: EncounterRuleWarningCodeDto[] = [
  'TARGET_DISPOSITION',
  'TARGET_RANGE_UNCHECKED'
]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function stabilizeRoom(currentHitPoints?: number) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [],
    characterPlay: currentHitPoints === undefined ? undefined : { currentHitPoints },
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterEquipment: [healersKit],
    characterAction: (action) => action.label === healersKit.label
  })
}

async function settledApplicationOutputs(
  room: Awaited<ReturnType<typeof stabilizeRoom>>,
  commandId: string
) {
  const history = await readRoomHistory(room.room.base.stub)
  const receipt = history.receipts.find(
    (candidate) => candidate.commandId === commandId && candidate.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The root action receipt is missing.')
  const execution = parseReceiptExecution(receipt)
  if (execution.status !== 'COMPLETE') throw new Error('The root action did not complete.')
  return execution.applicationOutputs
}

describe('a stabilize action (the Healer’s Kit) in the room', () => {
  it('is offered, stabilizes a dying Character and spends one charge', async () => {
    const room = await stabilizeRoom(0)
    const { command, answer } = await room.startAction(FIGHTER_ACTOR_ID, TOUCH_WITHOUT_SCENE)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect(await settledApplicationOutputs(room, command.commandId)).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceApplications: [],
      sourceCharacterId: FIGHTER_ID,
      resourceConsumption: {
        chargeId: healersKit.charges?.id,
        cost: 1,
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: CHARGES,
        afterRemaining: CHARGES - 1
      },
      targetTransition: {
        before: { currentHitPoints: 0, deathSaves: { successes: 0, failures: 0, stable: false } },
        after: { currentHitPoints: 0, deathSaves: { successes: 0, failures: 0, stable: true } }
      },
      applications: [{ kind: 'STABILIZE', applied: true }]
    })
  })

  it('warns, overridably, for a target that is not dying and then changes nothing', async () => {
    const room = await stabilizeRoom()
    const refused = await room.startAction(FIGHTER_ACTOR_ID)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('TARGET_NOT_DYING')

    const { command, answer } = await room.startAction(FIGHTER_ACTOR_ID, [
      ...TOUCH_WITHOUT_SCENE,
      'TARGET_NOT_DYING'
    ])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const outputs = await settledApplicationOutputs(room, command.commandId)
    if (outputs?.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected a Character batch.')
    expect(outputs.applications).toMatchObject([{ kind: 'STABILIZE', applied: false }])
    expect(outputs.targetTransition.after).toEqual(outputs.targetTransition.before)
  })
})
