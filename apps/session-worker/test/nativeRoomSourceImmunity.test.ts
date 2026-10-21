import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, fireballWolf } from './actionRoomFixture.js'
import { frightenedId } from './areaConditionFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5l (D156): a creature that saves against a source's Bite is immune to that source's Bite
 * for an hour. The room refuses the immune creature as a single target and leaves it out of an area.
 */

const SOURCE_ID = testUuid(0x9a0)
const IMMUNE_ID = testUuid(0x9a1)
const OTHER_ID = testUuid(0x9a2)

afterEach(() => {
  closeTrackedSockets()
})

/** `base` with its Bite's failed save frightening until the end of the biter's next turn, and a success making the target immune to it for an hour. */
function immuneOnSave(base: CreatureAuthored): CreatureAuthored {
  return {
    ...base,
    features: base.features.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              paths: [
                {
                  id: '00000000-0000-4000-8000-0000000009b0',
                  order: 1,
                  pathCode: 'ON_SAVE_FAIL' as const,
                  groupType: 'SINGLE' as const,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: '00000000-0000-4000-8000-0000000009b1',
                    resultKind: 'SINGLE' as const,
                    duration: {
                      id: '00000000-0000-4000-8000-0000000009b2',
                      durationKind: 'ROUND' as const,
                      amount: 1
                    },
                    lifecycle: {
                      turnAnchor: { actor: 'SOURCE' as const, boundary: 'END_OF_TURN' as const }
                    },
                    outcomes: [
                      {
                        id: '00000000-0000-4000-8000-0000000009b3',
                        effectKind: 'CONDITION' as const,
                        conditionId: frightenedId(),
                        recordsSource: true
                      }
                    ]
                  }
                },
                {
                  id: '00000000-0000-4000-8000-0000000009b4',
                  order: 2,
                  pathCode: 'ON_SAVE_SUCCESS' as const,
                  groupType: 'SINGLE' as const,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: '00000000-0000-4000-8000-0000000009b5',
                    resultKind: 'SINGLE' as const,
                    duration: {
                      id: '00000000-0000-4000-8000-0000000009b6',
                      durationKind: 'HOUR' as const,
                      amount: 1
                    },
                    outcomes: [
                      {
                        id: '00000000-0000-4000-8000-0000000009b7',
                        effectKind: 'SOURCE_IMMUNITY' as const
                      }
                    ]
                  }
                }
              ]
            }))
          }
    )
  }
}

/** The biter, the creature that will save, and one more; the biter acts first. */
function immunityRoom(biter: CreatureAuthored) {
  const creature = immuneOnSave(biter)
  return actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      srdCreatureActor({ id: IMMUNE_ID, creature: plainWolf }),
      srdCreatureActor({ id: OTHER_ID, creature: plainWolf })
    ],
    ownerFeatureId: creature.features.find((feature) => feature.label === 'Bite')?.id
  })
}

type Room = Awaited<ReturnType<typeof immunityRoom>>

/** Advances the turn back to the biter, a round on. */
async function nextRound(room: Room) {
  for (let turn = 0; turn < 3; turn += 1) await room.advanceTurn()
}

/** The source immunities the room holds, by holder. */
async function immunities(room: Room) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.flatMap((effect) => {
    const definition = activeRuleEffectDefinitionDtoSchema.parse(JSON.parse(effect.definitionJson))
    return definition.stateContributions.some(({ kind }) => kind === 'SOURCE_IMMUNITY')
      ? [effect.targetActorId]
      : []
  })
}

describe('a creature immune to this source’s use of an action (SPELLS-31.T5l, D156)', () => {
  it('refuses the immune creature as the target of the source’s next Bite', async () => {
    const room = await immunityRoom(biteWolf('SAVE'))
    const first = await room.startAction(IMMUNE_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
    const { request } = decision.pending
    const saved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: request.rollMode
    })
    expect(saved.type, JSON.stringify(saved)).toBe('COMMAND_COMMITTED')
    expect(await immunities(room)).toEqual([IMMUNE_ID])

    await nextRound(room)
    const before = await readRoomHistory(room.room.base.stub)
    const refused = await room.startAction(IMMUNE_ID, ['TARGET_RANGE_UNCHECKED'])

    expect(refused.answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Immune to Bite'
    })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
  })

  it('leaves the immune creature out of the source’s next area, with no save', async () => {
    const room = await immunityRoom(fireballWolf())
    const first = await room.startAreaAction({ x: 50, y: 150 })
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room, { [IMMUNE_ID]: 20 })
    expect(await immunities(room)).toEqual([IMMUNE_ID])

    await nextRound(room)
    const second = await room.startAreaAction({ x: 50, y: 150 })
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area’s saves.')

    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [SOURCE_ID, OTHER_ID].sort()
    )
  })
})
