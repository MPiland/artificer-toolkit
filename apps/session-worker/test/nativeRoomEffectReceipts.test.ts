import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x740)
const TARGET_ID = testUuid(0x741)
const CHARACTER_ACTOR_ID = testUuid(0x742)
const CHARACTER_ID = testUuid(0x743)
const CHARGE_ID = '00000000-0000-4000-8000-0000000007c0'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Feature = NonNullable<CreatureAuthored['features']>[number]

/** `creature` with its Bite rewritten by `rewrite`; the room validates it when the Action starts. */
function withBite(
  creature: CreatureAuthored,
  rewrite: (bite: Feature) => Feature
): CreatureAuthored {
  return {
    ...creature,
    features: creature.features?.map((feature) =>
      feature.label === 'Bite' ? rewrite(feature) : feature
    )
  }
}

const conditionId = (code: string) => {
  const condition = srdSystemRecord.conditionTypes.find((candidate) => candidate.code === code)
  if (!condition) throw new Error(`The SRD condition ${code} is missing.`)
  return condition.id
}
const dexterityId = srdSystemRecord.abilities?.find(({ code }) => code === 'DEXTERITY')?.id
if (!dexterityId) throw new Error('The SRD Dexterity ability is missing.')

/** A Bite that spends its one charge to deal one damage to any one target. */
const chargedBite = withBite(plainWolf, (bite) => ({
  ...bite,
  charges: {
    id: CHARGE_ID,
    limitKind: 'FIXED_AMOUNT' as const,
    scalingKind: 'NONE' as const,
    resetKind: 'MANUAL' as const,
    amount: 1
  },
  effects: bite.effects?.map((effect) => ({
    ...effect,
    invocation: {
      ...effect.invocation,
      triggerCode: 'ACTIVATED' as const,
      range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const },
      resourceUse: { chargeId: CHARGE_ID, cost: 1 }
    },
    paths: effect.paths.slice(0, 1).map((path) => {
      if (!('resultBlock' in path)) return path
      return {
        ...path,
        pathCode: 'ON_USE' as const,
        resultBlock: {
          ...path.resultBlock,
          outcomes: path.resultBlock.outcomes.map((outcome) => {
            if (outcome.effectKind !== 'DAMAGE' || outcome.damageTypeId === undefined)
              throw new Error('Expected Bite damage.')
            return {
              id: outcome.id,
              effectKind: 'DAMAGE' as const,
              damageTypeId: outcome.damageTypeId,
              valueKind: 'FIXED' as const,
              scalingKind: 'NONE' as const,
              amount: 1
            }
          })
        }
      }
    })
  }))
}))

/** A self Bite that heals one point and keeps healing at each turn start for two rounds. */
const recurringHealBite = withBite(plainWolf, (bite) => ({
  ...bite,
  effects: bite.effects?.map((effect) => ({
    ...effect,
    invocation: {
      ...effect.invocation,
      triggerCode: 'ACTIVATED' as const,
      range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
      targeting: { selectionKind: 'SELF' as const }
    },
    paths: effect.paths.slice(0, 1).map((path) => {
      if (!('resultBlock' in path)) return path
      return {
        ...path,
        pathCode: 'ON_USE' as const,
        resultBlock: {
          ...path.resultBlock,
          id: '00000000-0000-4000-8000-0000000007c1',
          duration: {
            id: '00000000-0000-4000-8000-0000000007c2',
            durationKind: 'ROUND' as const,
            amount: 2
          },
          lifecycle: { recurringKind: 'START_OF_TURN' as const },
          outcomes: [
            {
              id: '00000000-0000-4000-8000-0000000007c3',
              effectKind: 'HEAL' as const,
              valueKind: 'FIXED' as const,
              scalingKind: 'NONE' as const,
              amount: 1
            }
          ]
        }
      }
    })
  }))
}))

/** A Dexterity-save Bite whose failure frightens for two rounds, re-saved at the target's turn end. */
const frighteningBite = withBite(biteWolf('SAVE'), (bite) => ({
  ...bite,
  effects: bite.effects?.map((effect) => ({
    ...effect,
    paths: effect.paths.slice(0, 1).map((path) => {
      if (!('resultBlock' in path)) return path
      return {
        id: path.id,
        order: path.order,
        pathCode: 'ON_SAVE_FAIL' as const,
        groupType: 'SEQUENTIAL' as const,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: '00000000-0000-4000-8000-0000000007ca',
          resultKind: 'SEQUENCE' as const,
          duration: {
            id: '00000000-0000-4000-8000-0000000007c4',
            durationKind: 'ROUND' as const,
            amount: 2
          },
          outcomes: [
            {
              id: '00000000-0000-4000-8000-0000000007c5',
              effectKind: 'CONDITION' as const,
              conditionId: conditionId('FRIGHTENED')
            },
            {
              id: '00000000-0000-4000-8000-0000000007c6',
              effectKind: 'FOLLOW_UP_SAVE' as const,
              timing: 'TARGET_TURN_END' as const,
              savingThrow: {
                id: '00000000-0000-4000-8000-0000000007c7',
                dcMethod: 'FIXED_DC' as const,
                abilityDefinitionId: dexterityId,
                baseDc: 10
              },
              attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
              onSuccess: { kind: 'END' as const },
              onFailure: { kind: 'CONTINUE' as const },
              onDurationComplete: { kind: 'END' as const }
            }
          ]
        }
      }
    })
  }))
}))

/** An attack (+10) whose hit binds the target to the attacker for a Medium-sized target. */
const bindingBite = withBite(biteWolf('ATTACK'), (bite) => ({
  ...bite,
  rollDefinitions: bite.rollDefinitions?.map((roll) => ({
    ...roll,
    expression: { count: 1, die: 20, modifier: 10 }
  })),
  effects: bite.effects?.map((effect) => ({
    ...effect,
    paths: effect.paths.map((path) =>
      !('resultBlock' in path)
        ? path
        : {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              outcomes: [
                {
                  id: '00000000-0000-4000-8000-0000000007c8',
                  effectKind: 'ACTOR_RELATIONSHIP' as const,
                  heldAtOnce: 1,
                  modules: [
                    {
                      id: '00000000-0000-4000-8000-0000000007c9',
                      order: 1,
                      kind: 'TARGET_SIZE_MAXIMUM' as const,
                      sizeCode: 'MEDIUM' as const
                    }
                  ],
                  conditions: []
                }
              ]
            }
          }
    )
  }))
}))

/** `creature` acting first, next to the player's Character; the GM rolls the Creature's dice. */
function againstCharacter(
  creature: CreatureAuthored,
  rolls: readonly number[] = [],
  characterPlay?: Parameters<typeof actionRoom>[0]['characterPlay']
) {
  return actionRoom({
    characterPlay,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(creature, 'Bite').id,
    autoRoll: 'GAME_MASTER',
    rolls
  })
}

/** The held receipt of the settled action `commandId`: its typed outputs, as the room alone holds them (D85). */
async function settledOutputs(room: Awaited<ReturnType<typeof actionRoom>>, commandId: string) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find((row) => row.commandId === commandId)
  if (!receipt) throw new Error('The action receipt is missing.')
  const execution = parseReceiptExecution(receipt)
  if (execution.status !== 'COMPLETE')
    throw new Error(`Expected COMPLETE, got ${execution.status}.`)
  return execution.applicationOutputs
}

/** Starts the action at `targetActorId` and, when its save waits on the player, answers it with `saveFace`. */
async function settle(
  room: Awaited<ReturnType<typeof actionRoom>>,
  targetActorId: string,
  saveFace: number | null = null
) {
  const { command, answer } = await room.startAction(targetActorId, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  if (saveFace !== null) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
    const { request } = decision.pending
    const resolved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: request.rollMode === 'NORMAL' ? [saveFace] : [saveFace, saveFace],
      rollMode: request.rollMode
    })
    expect(resolved.type).toBe('COMMAND_COMMITTED')
  }
  await expect(readPendingActionDecision(room.room.base.stub)).resolves.toBeNull()
  return settledOutputs(room, command.commandId)
}

describe('effect and resource receipts of Creature actions in the room', () => {
  it('records the source charge spent by a Creature action against a Character', async () => {
    const room = await againstCharacter(chargedBite)
    const outputs = await settle(room, CHARACTER_ACTOR_ID)
    expect(outputs).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceActorId: SOURCE_ID,
      sourceCharacterId: null,
      targetActorId: CHARACTER_ACTOR_ID,
      featureResourceConsumption: { ownerActorId: SOURCE_ID, beforeUsed: 0, afterUsed: 1 }
    })
  })

  it('plans the outcome against the Sheet condition the Character already carries', async () => {
    const deafened = conditionId('DEAFENED')
    const room = await againstCharacter(chargedBite, [], {
      conditions: [{ conditionTypeId: deafened, label: 'Deafened' }]
    })
    const outputs = await settle(room, CHARACTER_ACTOR_ID)
    expect(outputs).toMatchObject({ targetTransition: { before: { conditionIds: [deafened] } } })
  })

  it('records the actor relationship a hit creates on a Character as one CREATE transition', async () => {
    // A natural 15 and +10 hit the Character.
    const room = await againstCharacter(bindingBite, [14])
    const outputs = await settle(room, CHARACTER_ACTOR_ID)
    if (outputs.kind !== 'CHARACTER_MECHANICS_BATCH') throw new Error('Expected a Character batch.')
    expect(outputs.activeEffectTransitions).toEqual([
      expect.objectContaining({
        kind: 'CREATE',
        characterId: CHARACTER_ID,
        sourceEncounterId: room.room.encounterId,
        maintainedEffectStateId: null
      })
    ])
  })

  it('records the Frightened condition a failed save puts on a Character as one CREATE transition', async () => {
    const room = await againstCharacter(frighteningBite)
    // A natural 1 fails the DC 10 Dexterity save.
    const outputs = await settle(room, CHARACTER_ACTOR_ID, 1)
    if (outputs.kind !== 'CHARACTER_MECHANICS_BATCH') throw new Error('Expected a Character batch.')
    expect(outputs.activeEffectTransitions).toEqual([expect.objectContaining({ kind: 'CREATE' })])
  })

  it('records the recurring heal a Creature gives itself as one CREATE transition', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: recurringHealBite }),
        srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
      ],
      ownerFeatureId: creatureFeature(recurringHealBite, 'Bite').id,
      autoRoll: 'GAME_MASTER'
    })
    const outputs = await settle(room, SOURCE_ID)
    if (outputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error('Expected an Encounter actor batch.')
    expect(outputs.activeEffectTransitions).toEqual([expect.objectContaining({ kind: 'CREATE' })])
  })
})
