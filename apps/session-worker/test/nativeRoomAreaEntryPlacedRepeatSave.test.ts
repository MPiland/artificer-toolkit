import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { frightenedId } from './areaConditionFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  type RoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-14.T2e2b2 (D167): an area places each creature's effect under that creature's entry
 * occurrence, not the area's own. An effect the area placed was not on its holder when the area's
 * damage landed, so it owes no repeat save against that damage; an effect the holder already carried
 * does. The room and persistence both leave out the effects the area's entries placed, at the first
 * plan and when the chain resumes, or the commit refuses the room's chain.
 */

const CASTER_ID = testUuid(0x9e0)
const FIRST_ID = testUuid(0x9e1)
const SECOND_ID = testUuid(0x9e2)
const LAUGHTER_EFFECT_ID = testUuid(0x9e4)

afterEach(() => {
  closeTrackedSockets()
})

/**
 * The point-area Wolf whose failed save deals its damage and frightens for two rounds; the creature
 * repeats the save at the end of each of its turns and each time it takes damage.
 */
function frighteningFireballWolf() {
  const base = fireballWolf()
  return creatureAuthoredDtoSchema.parse({
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
                      resultBlock: {
                        ...path.resultBlock,
                        duration: {
                          id: '00000000-0000-4000-8000-0000000009e5',
                          durationKind: 'ROUND' as const,
                          amount: 2
                        },
                        outcomes: [
                          ...path.resultBlock.outcomes,
                          {
                            id: '00000000-0000-4000-8000-0000000009e6',
                            effectKind: 'CONDITION' as const,
                            conditionId: frightenedId()
                          },
                          {
                            id: '00000000-0000-4000-8000-0000000009e7',
                            effectKind: 'FOLLOW_UP_SAVE' as const,
                            timing: 'TARGET_TURN_END' as const,
                            repeatTriggers: [
                              { kind: 'DAMAGE_TAKEN' as const, by: 'ANYONE' as const }
                            ],
                            savingThrow: {
                              id: '00000000-0000-4000-8000-0000000009e8',
                              dcMethod: 'FIXED_DC' as const,
                              abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
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
              )
            }))
          }
    )
  })
}

function repeatSaveEffectIds(history: RoomHistory) {
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [execution.applicationOutputs.activeEffect.id]
      : []
  })
}

describe('an area whose failed save places an effect that repeats on damage (QUALITY-14.T2e2b2)', () => {
  it('owes no repeat save for the effects its own entries placed, only for the one a holder already carried', async () => {
    const creature = frighteningFireballWolf()
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature }),
        srdCreatureActor({ id: FIRST_ID, creature: plainWolf }),
        srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
      ],
      ownerFeatureId: creature.features.find((feature) => feature.label === 'Bite')?.id,
      seed: async ({ effects, encounterId, occurredAt }) => {
        const planned = plannedTimedCondition({
          encounterId,
          sourceActorId: CASTER_ID,
          holderActorId: FIRST_ID,
          spell: hideousLaughter,
          lifetimeScope: 'ENCOUNTER'
        })
        await effects.create({
          id: LAUGHTER_EFFECT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: FIRST_ID },
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    })
    const { answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    // Every caught creature fails: each takes the damage and is frightened by its own entry.
    await answerAllSaves(room)

    const settled = await readRoomHistory(room.room.base.stub)
    const placed = settled.activeEffects.filter(({ id }) => id !== LAUGHTER_EFFECT_ID)
    expect(placed.map(({ targetActorId }) => targetActorId).sort()).toEqual(
      [CASTER_ID, FIRST_ID, SECOND_ID].sort()
    )

    // The one repeat save the damage owes: the Laughter the first Wolf held before the area.
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a repeat save.')
    const { rollerActorId, request } = decision.pending
    expect(rollerActorId).toBe(FIRST_ID)
    const resolved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [1, 1],
      rollMode: request.rollMode
    })
    expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.room.base.stub)
    expect(repeatSaveEffectIds(after)).toEqual([LAUGHTER_EFFECT_ID])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(after.activeEffects.map(({ id }) => id).sort()).toEqual(
      [LAUGHTER_EFFECT_ID, ...placed.map(({ id }) => id)].sort()
    )
  })
})
