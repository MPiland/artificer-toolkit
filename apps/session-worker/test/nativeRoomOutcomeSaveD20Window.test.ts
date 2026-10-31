import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x7e0)
const TARGET_ID = testUuid(0x7e1)
const HELD_DIE_ID = testUuid(0x7e2)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const frightened = srdSystemRecord.conditionTypes.find(({ code }) => code === 'FRIGHTENED')
const dexterityId = srdSystemRecord.abilities?.find(({ code }) => code === 'DEXTERITY')?.id
if (!frightened || !dexterityId) throw new Error('The SRD vocabulary fixture is missing.')

/** A Bite that hits (attack +4) for 1 damage, then calls for an immediate Dexterity save (DC 10) against Frightened. */
const hitThenSaveBite: CreatureAuthored = (() => {
  const base = biteWolf('ATTACK')
  return {
    ...base,
    features: base.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              paths: effect.paths.map((path) =>
                !('resultBlock' in path)
                  ? path
                  : {
                      ...path,
                      groupType: 'SEQUENTIAL' as const,
                      resultBlock: {
                        ...path.resultBlock,
                        id: '00000000-0000-4000-8000-0000000007e7',
                        resultKind: 'SEQUENCE' as const,
                        duration: {
                          id: '00000000-0000-4000-8000-0000000007e3',
                          durationKind: 'ROUND' as const,
                          amount: 2
                        },
                        outcomes: [
                          ...path.resultBlock.outcomes.map((outcome) => {
                            if (outcome.effectKind !== 'DAMAGE')
                              throw new Error('Expected Bite damage.')
                            return {
                              id: outcome.id,
                              effectKind: 'DAMAGE' as const,
                              damageTypeId: outcome.damageTypeId,
                              valueKind: 'DICE' as const,
                              scalingKind: 'NONE' as const,
                              diceConfig: '1d6'
                            }
                          }),
                          {
                            id: '00000000-0000-4000-8000-0000000007e4',
                            effectKind: 'FOLLOW_UP_SAVE' as const,
                            timing: 'IMMEDIATE' as const,
                            savingThrow: {
                              id: '00000000-0000-4000-8000-0000000007e5',
                              dcMethod: 'FIXED_DC' as const,
                              abilityDefinitionId: dexterityId,
                              baseDc: 10
                            },
                            attempts: { kind: 'ONCE' as const },
                            onFailure: {
                              kind: 'OUTCOMES' as const,
                              endCurrent: false,
                              resultKind: 'SINGLE' as const,
                              outcomes: [
                                {
                                  id: '00000000-0000-4000-8000-0000000007e6',
                                  effectKind: 'CONDITION' as const,
                                  conditionId: frightened.id
                                }
                              ]
                            },
                            onSuccess: { kind: 'END' as const }
                          }
                        ]
                      }
                    }
              )
            }))
          }
    )
  }
})()

type Room = Awaited<ReturnType<typeof actionRoom>>

/** The Bite hits the Wolf holding Resistance's after-the-roll die; the Wolf's nested save then waits on its d20. */
async function openWindow() {
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: hitThenSaveBite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(hitThenSaveBite, 'Bite').id,
    seed: seedModifierGrant({
      sourceActorId: TARGET_ID,
      holderActorId: TARGET_ID,
      lifecycle: {},
      effect: heldSaveDieEffect(),
      sourceLabel: resistance.label,
      id: HELD_DIE_ID
    })
  })
  const started = (await room.startAction(TARGET_ID)).answer
  expect(started.type, JSON.stringify(started)).toBe('COMMAND_COMMITTED')
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack prompt.')
  const hit = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId: attack.pending.request.requestId,
    rawFaces: [15],
    rollMode: attack.pending.request.rollMode
  })
  expect(hit.type, JSON.stringify(hit)).toBe('COMMAND_COMMITTED')
  const damage = await room.pendingDecision()
  if (damage.pending.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected the damage die.')
  const dealt = await room.resolve(damage, {
    kind: 'ENTER_INTEGER',
    requestId: damage.pending.request.requestId,
    value: 1
  })
  expect(dealt.type, JSON.stringify(dealt)).toBe('COMMAND_COMMITTED')
  const save = await room.pendingDecision()
  if (save.pending.kind !== 'D20_EVIDENCE')
    throw new Error(
      `Expected the nested save prompt: ${JSON.stringify(save.pending).slice(0, 600)}`
    )
  // A natural 5 fails the DC 10 save without the die.
  const rolled = await room.resolve(save, {
    kind: 'ENTER_DICE',
    requestId: save.pending.request.requestId,
    rawFaces: [5],
    rollMode: save.pending.request.rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
  return { room, decision, pending: decision.pending }
}

const holdsDie = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).activeEffects.some(
    (effect) => effect.id === HELD_DIE_ID
  )

/** The condition ids the target holds once the Bite settles. */
async function targetConditions(room: Room) {
  const batch = areaReceipts(await readRoomHistory(room.room.base.stub)).children.find(
    ({ outputs }) =>
      outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === TARGET_ID
  )?.outputs
  if (batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') throw new Error('The Bite left no batch.')
  return batch.targetTransition.after.conditionIds
}

describe('room d20 window on the nested save of a hit', () => {
  it('holds the nested save for the die once the d20 is seen, applying and spending nothing', async () => {
    const { room, pending } = await openWindow()
    expect(pending).toMatchObject({
      rollerActorId: TARGET_ID,
      d20: { selectedNatural: 5 },
      options: [{ label: 'Resistance', count: 1, faces: 4, sign: 'ADD' }]
    })
    expect(areaReceipts(await readRoomHistory(room.room.base.stub)).children).toEqual([])
    expect(await holdsDie(room)).toBe(true)
  })

  it('adds the die to the nested save, which then passes, and ends the spent effect', async () => {
    const { room, decision, pending } = await openWindow()
    const used = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [4]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await holdsDie(room)).toBe(false)
    expect(await targetConditions(room)).not.toContain(frightened.id)
  })

  it('keeps the roll and the die when declined, so the nested save fails', async () => {
    const { room, decision, pending } = await openWindow()
    const declined = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await holdsDie(room)).toBe(true)
    expect(await targetConditions(room)).toContain(frightened.id)
  })
})
