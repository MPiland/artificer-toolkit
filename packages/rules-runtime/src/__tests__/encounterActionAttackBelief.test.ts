import {
  SRD_BLINDSIGHT_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { ServerRuleExecutionD20EvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { describe, expect, it } from 'vitest'

import { resolutionForRetainedEvidence } from '../encounterActionRetainedEvidence.js'
import { actionD20RollRecord } from '../encounterRuleCheckRolls.js'
import {
  advanceNativeActionGraphs,
  type PendingNativeActionGraphs
} from '../encounterActionExecution.js'
import type { EncounterEvidenceAnswer } from '../encounterEvidenceAnswer.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  srdConditionId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xc1)
const TARGET_ID = testUuid(0xc2)
const OCCURRENCE_ID = testUuid(0xc3)
const INVISIBLE = srdConditionId('INVISIBLE')
const BLINDED = srdConditionId('BLINDED')
const blindsightLabel = srdSystemRecord.senses.find(
  (sense) => sense.id === SRD_BLINDSIGHT_SENSE_ID
)!.label

async function prepare(input: {
  attackerConditionIds?: readonly string[]
  targetConditionIds?: readonly string[]
  targetBlindsight?: boolean
  attackPerception?: boolean
}) {
  return prepareCreatureAction({
    actor: creatureActor({
      id: ATTACKER_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })],
      conditionIds: input.attackerConditionIds ?? []
    }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Wolf',
      features: [],
      conditionIds: input.targetConditionIds ?? []
    }),
    featureId: QUILL_VOLLEY_ID,
    overridable: true,
    attackPerception: input.attackPerception ?? true,
    ...(input.targetBlindsight ? { targetBlindsight: true } : {})
  })
}

type Prepared = Awaited<ReturnType<typeof prepare>>

/** Runs the real action up to its next prompt, or resumes it with one answer; faces scripted for the room's own rolls. */
function advance(
  prepared: Prepared,
  step: {
    resume?: { pending: PendingNativeActionGraphs; resolution: EncounterEvidenceAnswer }
    rolls?: number[]
    withSight?: boolean
  } = {}
) {
  const rolls = [...(step.rolls ?? [])]
  return advanceNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId: OCCURRENCE_ID,
    autoRoll: { SOURCE: false, TARGET: false },
    binding: prepared.binding,
    afterTest: async () => undefined,
    ...(step.withSight === false ? {} : { attackSight: prepared.attackSight }),
    ...(step.resume ? { resume: step.resume } : {}),
    random: (maxExclusive) => {
      const value = rolls.shift()
      if (value === undefined || value < 0 || value >= maxExclusive)
        throw new Error(`Unexpected random call (max ${maxExclusive}).`)
      return value
    }
  })
}

async function prompt(prepared: Prepared, withSight = true) {
  const pending = await advance(prepared, { withSight })
  if (pending.kind !== 'PENDING') throw new Error('Expected the d20 prompt.')
  return pending
}

/** Answers the d20 prompt and then every later request automatically, up to the settled action. */
async function settle(
  prepared: Prepared,
  pending: PendingNativeActionGraphs,
  resolution: EncounterEvidenceAnswer,
  rolls: number[] = []
) {
  let step = await advance(prepared, { resume: { pending, resolution }, rolls })
  while (step.kind === 'PENDING' && step.twoPhase?.phase === 'OUTCOME')
    step = await advance(prepared, {
      resume: {
        pending: step,
        resolution: { kind: 'AUTO_ROLL', requestId: step.continuation.request.requestId }
      },
      rolls: [0, 0, 0]
    })
  return step
}

describe('attack d20 believed versus true mode through the action execution', () => {
  it('prompts the believed mode and keeps the true policy beside it', async () => {
    const prepared = await prepare({ attackerConditionIds: [INVISIBLE], targetBlindsight: true })
    const pending = await prompt(prepared)
    expect(pending.d20Policy?.rollMode).toBe('NORMAL')
    expect(pending.d20Belief).toMatchObject({ rollMode: 'ADVANTAGE' })
    expect(pending.heldD20).toBeUndefined()
  })

  it('settles the true Normal mode over an Advantage roll: all dice kept, one cancelled, generic and GM captions', async () => {
    const prepared = await prepare({ attackerConditionIds: [INVISIBLE], targetBlindsight: true })
    const pending = await prompt(prepared)
    const settled = await settle(prepared, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.continuation.request.requestId,
      rawFaces: [4, 16],
      rollMode: 'ADVANTAGE'
    })
    if (settled.kind !== 'COMPLETE') throw new Error('Expected the settled action.')
    expect(settled.d20).toMatchObject({
      rollMode: 'NORMAL',
      derivedRollMode: 'NORMAL',
      rawFaces: [4],
      selectedNatural: 4,
      modeAdjustment: {
        rolledMode: 'ADVANTAGE',
        rolledFaces: [4, 16],
        addedFaces: [],
        cancelledRollIndexes: [1],
        addedRollIndexes: [],
        playerCaption: 'Advantage cancelled: the target can sense you',
        gmReason: `Wolf senses Quill Beast with ${blindsightLabel}`
      }
    })
    expect(JSON.stringify(settled.d20?.modeAdjustment?.playerCaption)).not.toContain(
      blindsightLabel
    )
  })

  it('holds the entered die when the true mode needs one more, then settles with exactly one more', async () => {
    const prepared = await prepare({ targetConditionIds: [INVISIBLE] })
    const pending = await prompt(prepared)
    expect(pending.d20Policy?.rollMode).toBe('DISADVANTAGE')
    expect(pending.d20Belief).toMatchObject({ rollMode: 'NORMAL' })
    const requestId = pending.continuation.request.requestId

    const held = await advance(prepared, {
      resume: {
        pending,
        resolution: {
          kind: 'ENTER_DICE',
          requestId,
          rawFaces: [12],
          rollMode: 'NORMAL'
        }
      }
    })
    if (held.kind !== 'PENDING') throw new Error('Expected a held d20.')
    expect(held.continuation.request.requestId).toBe(requestId)
    expect(held.heldD20).toEqual({
      rolledMode: 'NORMAL',
      faces: [12],
      playerCaption: "Disadvantage: you can't see the target",
      gmReason: "Quill Beast can't see Wolf"
    })
    expect(held.d20Belief).toEqual(pending.d20Belief)

    await expect(
      advance(prepared, {
        resume: {
          pending: held,
          resolution: {
            kind: 'ENTER_DICE',
            requestId,
            rawFaces: [3, 5],
            rollMode: 'ADVANTAGE'
          }
        }
      })
    ).rejects.toThrow()

    const settled = await settle(prepared, held, {
      kind: 'ENTER_DICE',
      requestId,
      rawFaces: [5],
      rollMode: 'NORMAL'
    })
    if (settled.kind !== 'COMPLETE') throw new Error('Expected the settled action.')
    expect(settled.d20).toMatchObject({
      rollMode: 'DISADVANTAGE',
      rawFaces: [12, 5],
      selectedNatural: 5,
      modeAdjustment: {
        rolledMode: 'NORMAL',
        rolledFaces: [12],
        addedFaces: [5],
        cancelledRollIndexes: [],
        addedRollIndexes: [1],
        playerCaption: "Disadvantage: you can't see the target",
        gmReason: "Quill Beast can't see Wolf"
      }
    })
  })

  it('rolls the missing die itself for an app roll', async () => {
    const prepared = await prepare({ targetConditionIds: [INVISIBLE] })
    const pending = await prompt(prepared)
    const settled = await settle(
      prepared,
      pending,
      {
        kind: 'SYSTEM_ROLL',
        requestId: pending.continuation.request.requestId,
        rollId: testUuid(0xc4),
        faces: [12],
        rollMode: 'NORMAL',
        keep: 'FIRST'
      },
      [6]
    )
    if (settled.kind !== 'COMPLETE') throw new Error('Expected the settled action.')
    expect(settled.d20).toMatchObject({
      rollMode: 'DISADVANTAGE',
      rawFaces: [12, 7],
      selectedNatural: 7,
      modeAdjustment: { addedFaces: [7] }
    })
  })

  it('never lets a chosen mode settle a sight-governed d20, even with no belief to show', async () => {
    const prepared = await prepare({ attackerConditionIds: [BLINDED] })
    const pending = await prompt(prepared)
    expect(pending.d20Policy?.rollMode).toBe('DISADVANTAGE')
    expect(pending.d20Belief).toBeUndefined()
    const settled = await settle(prepared, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.continuation.request.requestId,
      rawFaces: [3, 18],
      rollMode: 'ADVANTAGE'
    })
    if (settled.kind !== 'COMPLETE') throw new Error('Expected the settled action.')
    expect(settled.d20).toMatchObject({
      rollMode: 'DISADVANTAGE',
      derivedRollMode: 'DISADVANTAGE',
      rawFaces: [3, 18],
      selectedNatural: 3,
      modeAdjustment: {
        rolledMode: 'ADVANTAGE',
        cancelledRollIndexes: [],
        addedFaces: [],
        playerCaption: null,
        gmReason: null
      }
    })
  })

  it('keeps the chosen-mode override for a roll sight does not decide', async () => {
    const prepared = await prepare({})
    const pending = await prompt(prepared)
    expect(pending.d20Belief).toBeUndefined()
    const settled = await settle(prepared, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.continuation.request.requestId,
      rawFaces: [3, 18],
      rollMode: 'ADVANTAGE'
    })
    if (settled.kind !== 'COMPLETE') throw new Error('Expected the settled action.')
    expect(settled.d20).toMatchObject({
      rollMode: 'ADVANTAGE',
      derivedRollMode: 'NORMAL',
      selectedNatural: 18
    })
    expect(settled.d20?.modeAdjustment).toBeUndefined()
  })

  it('cards an adjusted d20 with every die, the kept one and a caption for each reader', async () => {
    const ruleset: RollRecordDto['ruleset'] = {
      systemId: srdSystemRecord.id,
      code: srdSystemRecord.rulesetCode,
      version: srdSystemRecord.rulesetVersion
    }
    const card = (d20: ServerRuleExecutionD20EvidenceDto, reader: 'PLAYER' | 'GM') =>
      actionD20RollRecord({
        occurrenceId: OCCURRENCE_ID,
        checkIndex: 0,
        d20,
        actionLabel: 'Quill Volley',
        rollerLabel: 'Quill Beast',
        ruleset,
        createdAt: '2026-01-01T00:00:00.000Z',
        reader
      })
    const cancelled = await prepare({ attackerConditionIds: [INVISIBLE], targetBlindsight: true })
    const cancelledPrompt = await prompt(cancelled)
    const cancelledStep = await settle(cancelled, cancelledPrompt, {
      kind: 'ENTER_DICE',
      requestId: cancelledPrompt.continuation.request.requestId,
      rawFaces: [4, 16],
      rollMode: 'ADVANTAGE'
    })
    if (cancelledStep.kind !== 'COMPLETE' || !cancelledStep.d20) throw new Error('Expected a d20.')
    const player = card(cancelledStep.d20, 'PLAYER')
    const gm = card(cancelledStep.d20, 'GM')
    expect(player.evidence).toMatchObject({
      mode: 'NORMAL',
      keep: 'FIRST',
      total: cancelledStep.d20.total,
      terms: [{ rolls: [4, 16], keptRollIndex: 0 }]
    })
    expect(player.ruleCheck).toEqual({
      kind: 'D20_MODE_ADJUSTED',
      rolledMode: { code: 'ADVANTAGE', label: 'Advantage' },
      appliedMode: { code: 'NORMAL', label: 'Normal' },
      cancelledRollIndexes: [1],
      addedRollIndexes: [],
      caption: 'Advantage cancelled: the target can sense you'
    })
    expect(gm.id).not.toBe(player.id)
    expect(gm.evidence).toEqual(player.evidence)
    expect(gm.ruleCheck).toMatchObject({
      caption: `Wolf senses Quill Beast with ${blindsightLabel}`
    })
    expect(JSON.stringify(player)).not.toContain(blindsightLabel)

    const added = await prepare({ targetConditionIds: [INVISIBLE] })
    const addedPrompt = await prompt(added)
    const addedHeld = await advance(added, {
      resume: {
        pending: addedPrompt,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: addedPrompt.continuation.request.requestId,
          rawFaces: [12],
          rollMode: 'NORMAL'
        }
      }
    })
    if (addedHeld.kind !== 'PENDING') throw new Error('Expected a held d20.')
    const addedStep = await settle(added, addedHeld, {
      kind: 'ENTER_DICE',
      requestId: addedPrompt.continuation.request.requestId,
      rawFaces: [5],
      rollMode: 'NORMAL'
    })
    if (addedStep.kind !== 'COMPLETE' || !addedStep.d20) throw new Error('Expected a d20.')
    const addedCard = card(addedStep.d20, 'PLAYER')
    expect(addedCard.evidence).toMatchObject({
      mode: 'DISADVANTAGE',
      keep: 'LOWER',
      terms: [{ rolls: [12, 5], keptRollIndex: 1 }]
    })
    expect(addedCard.ruleCheck).toMatchObject({
      rolledMode: { code: 'NORMAL', label: 'Normal' },
      appliedMode: { code: 'DISADVANTAGE', label: 'Disadvantage' },
      cancelledRollIndexes: [],
      addedRollIndexes: [1]
    })
  })

  it('does not replay retained evidence that settled a sight-governed d20 in a chosen mode', async () => {
    const prepared = await prepare({ attackerConditionIds: [BLINDED] })
    const pending = await prompt(prepared)
    const requestId = pending.continuation.request.requestId
    const replay = (rollMode: 'ADVANTAGE' | 'DISADVANTAGE') =>
      resolutionForRetainedEvidence({
        gameSystemId: SRD_SYSTEM_ID,
        pending,
        integers: new Map(),
        d20: new Map([
          [
            requestId,
            {
              requestId,
              rollMode,
              keep: rollMode === 'ADVANTAGE' ? 'HIGHER' : 'LOWER',
              derivedRollMode: 'DISADVANTAGE',
              rawFaces: [3, 18],
              selectedNatural: rollMode === 'ADVANTAGE' ? 18 : 3
            }
          ]
        ]),
        used: new Set()
      })
    expect(() => replay('ADVANTAGE')).toThrow('stale')
    expect(replay('DISADVANTAGE')).toMatchObject({ kind: 'ENTER_DICE', rollMode: 'DISADVANTAGE' })
  })

  it('behaves as before for executors that pass no attack sight', async () => {
    const prepared = await prepare({ attackerConditionIds: [INVISIBLE], targetBlindsight: true })
    const pending = await prompt(prepared, false)
    expect(pending.d20Belief).toBeUndefined()
    const settled = await settle(prepared, pending, {
      kind: 'ENTER_DICE',
      requestId: pending.continuation.request.requestId,
      rawFaces: [4, 16],
      rollMode: 'ADVANTAGE'
    })
    if (settled.kind !== 'COMPLETE') throw new Error('Expected the settled action.')
    expect(settled.d20).toMatchObject({ rollMode: 'ADVANTAGE', selectedNatural: 16 })
    expect(settled.d20?.modeAdjustment).toBeUndefined()
  })
})
