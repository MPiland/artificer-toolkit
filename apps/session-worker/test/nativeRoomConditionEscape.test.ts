import {
  installedSrdCreature,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { djinni } from '@artificer-toolkit/source-data/srd/creatures/djinni.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-15.T3t: an effect whose authored follow-up check ends it on success is escapable. A
 * creature the effect restrains spends its Action on the check, or another creature within its
 * reach does, and a success ends the effect and the condition it held. The SRD Djinni's Create
 * Whirlwind authors such a check; nothing here or in the product names it.
 */

const DJINNI_ID = testUuid(0xf00)
const CAPTIVE_ID = testUuid(0xf01)
const RESCUER_ID = testUuid(0xf02)
const BYSTANDER_ID = testUuid(0xf03)
const RESTRAINED = srdCondition('Restrained')
const STRENGTH = SRD_ABILITY_DEFINITION_IDS.STRENGTH
const DC = 18
/** The whirlwind's point, on the captive's token; the rescuer stands in the next cell east. */
const CAPTIVE_AT = { x: 750, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Djinni raises its whirlwind on the captive, who fails its save; anyone else caught makes it. */
async function whirlwindRoom() {
  const creature = installedSrdCreature(djinni)
  const feature = creature.features.find(({ label }) => label === 'Create Whirlwind')
  if (!feature) throw new Error('The Djinni has no Create Whirlwind.')
  const room = await actionRoom({
    rolls: [],
    actors: [
      srdCreatureActor({ id: DJINNI_ID, creature }),
      srdCreatureActor({ id: CAPTIVE_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: RESCUER_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: BYSTANDER_ID, creature: plainWolf, disposition: 'FRIENDLY' })
    ],
    positions: {
      [CAPTIVE_ID]: CAPTIVE_AT,
      [RESCUER_ID]: { x: 850, y: 150 },
      [BYSTANDER_ID]: { x: 750, y: 650 }
    },
    ownerFeatureId: feature.id
  })
  const started = await room.startAreaAction(CAPTIVE_AT)
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  await answerAllSaves(room, { [RESCUER_ID]: 20 })
  expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  const history = await readRoomHistory(room.room.base.stub)
  const [effect, ...others] = history.activeEffects
  if (!effect || others.length > 0) throw new Error('Expected the one whirlwind effect.')
  return { room, effectId: effect.id }
}

type WhirlwindRoom = Awaited<ReturnType<typeof whirlwindRoom>>['room']

/** `actorId` spends its Action on the Strength check against the effect, and answers it with `face`. */
async function escape(
  room: WhirlwindRoom,
  input: { actorId: string; effectId: string; face: number }
) {
  const sent = await room.send({
    type: 'ESCAPE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: input.actorId,
    ...(input.actorId !== CAPTIVE_ID && { heldActorId: CAPTIVE_ID }),
    activeEffectId: input.effectId,
    checkDefinitionId: STRENGTH,
    acknowledgedWarnings: []
  })
  expect(sent.type, JSON.stringify(sent)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
  const answered = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: decision.pending.request.requestId,
    rawFaces: [input.face],
    rollMode: decision.pending.request.rollMode
  })
  expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
}

async function escapeState(room: WhirlwindRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    outputs: history.receipts.flatMap((receipt) => {
      const execution = parseReceiptExecution(receipt)
      return execution.status === 'COMPLETE' &&
        execution.applicationOutputs?.kind === 'ESCAPE_CHECK'
        ? [execution.applicationOutputs]
        : []
    }),
    effectIds: history.activeEffects.map(({ id }) => id),
    captiveConditions: readActorConditionIds(history, CAPTIVE_ID)
  }
}

describe('a creature escapes an effect its authored check ends (QUALITY-15.T3t), in the room', () => {
  it('restrains the creature that fails its save and offers it the escape, and its rescuer within reach the rescue', async () => {
    const { room, effectId } = await whirlwindRoom()
    expect(readActorConditionIds(await readRoomHistory(room.room.base.stub), CAPTIVE_ID)).toEqual([
      RESTRAINED
    ])
    const offered = { activeEffectId: effectId, dc: DC, actionCost: 'ACTION' }
    await room.advanceTurn()
    expect((await room.actionChoices(CAPTIVE_ID)).escapes).toMatchObject([
      { ...offered, checks: [{ checkDefinitionId: STRENGTH }] }
    ])
    await room.advanceTurn()
    expect((await room.actionChoices(RESCUER_ID)).escapes).toMatchObject([
      { ...offered, heldActorId: CAPTIVE_ID }
    ])
    // A creature beyond its own reach of the captive is offered no rescue.
    await room.advanceTurn()
    expect((await room.actionChoices(BYSTANDER_ID)).escapes).toEqual([])
  })

  it('keeps the creature restrained on a missed check, and frees it on a check that reaches the DC', async () => {
    const { room, effectId } = await whirlwindRoom()
    await room.advanceTurn()
    await escape(room, { actorId: CAPTIVE_ID, effectId, face: 2 })
    expect(await escapeState(room)).toMatchObject({
      outputs: [{ actorId: CAPTIVE_ID, outcome: 'FAILED', check: { dc: DC } }],
      effectIds: [effectId],
      captiveConditions: [RESTRAINED]
    })

    // Round the table back to the captive's next turn.
    for (let turn = 0; turn < 4; turn += 1) await room.advanceTurn()
    await escape(room, { actorId: CAPTIVE_ID, effectId, face: 20 })
    expect(await escapeState(room)).toMatchObject({
      outputs: [
        { outcome: 'FAILED' },
        { actorId: CAPTIVE_ID, outcome: 'ESCAPED', removedConditionIds: [RESTRAINED] }
      ],
      effectIds: [],
      captiveConditions: []
    })
  })

  it('lets a creature within reach free the restrained creature with its own check', async () => {
    const { room, effectId } = await whirlwindRoom()
    await room.advanceTurn()
    await room.advanceTurn()
    await escape(room, { actorId: RESCUER_ID, effectId, face: 20 })
    expect(await escapeState(room)).toEqual({
      outputs: [
        expect.objectContaining({
          actorId: RESCUER_ID,
          heldActorId: CAPTIVE_ID,
          outcome: 'ESCAPED',
          removedConditionIds: [RESTRAINED]
        })
      ],
      effectIds: [],
      captiveConditions: []
    })
  })
})
