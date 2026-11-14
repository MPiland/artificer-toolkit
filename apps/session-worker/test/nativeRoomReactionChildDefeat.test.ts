import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, deathBurstWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readActorHitPoints,
  readPendingActionContext,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-18.T3d (D219): a reaction chosen against a held action runs as its holder's own action, and
 * what that action's commit raises runs before the held action goes on. A Bite that hits a Wolf is
 * held for that Wolf, whose reaction to the hit costs it its last hit points; it drops to 0 and
 * bursts, so the burst is raised, and its saves answered, while the Bite still waits. The engine
 * knows no feature: the reaction is a homebrew feature built from core options, the burst a passive
 * effect of the same Wolf.
 */

const ATTACKER_ID = testUuid(0x9c0)
const BYSTANDER_ID = testUuid(0x9c1)
const REACTOR_ID = testUuid(0x9c2)
const attackBite = biteWolf('ATTACK')

/** Every authored row id of `value`, so a copy of it can carry ids of its own. */
function authoredIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(authoredIds)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, entry]) =>
    key === 'id' && typeof entry === 'string' ? [entry] : authoredIds(entry)
  )
}

const biteDamageTypeId = (() => {
  const [outcome] =
    creatureFeature(attackBite, 'Bite').effects?.flatMap((effect) =>
      effect.paths.flatMap((path) => ('resultBlock' in path ? path.resultBlock.outcomes : []))
    ) ?? []
  if (outcome?.effectKind !== 'DAMAGE') throw new Error('Expected Bite damage.')
  return outcome.damageTypeId
})()

/**
 * The Wolf that bursts (30 ft, Dexterity save against 1 damage) when it reaches 0 hit points, the
 * burst of `deathBurstWolf` under ids of its own, and that holds Backlash: a homebrew reaction to
 * being hit by an attack that deals 5 damage to the Wolf itself.
 */
const backlashBurster = (() => {
  const burst = creatureFeature(deathBurstWolf(30), 'Bite')
  const ids = authoredIds(burst)
  const renamed = JSON.parse(
    JSON.stringify(burst, (_key, entry: unknown) =>
      typeof entry === 'string' && ids.includes(entry)
        ? testUuid(0x9d0 + ids.indexOf(entry))
        : entry
    )
  ) as typeof burst
  return creatureAuthoredDtoSchema.parse({
    ...plainWolf,
    features: [
      ...(plainWolf.features ?? []),
      { ...renamed, label: 'Death Burst' },
      {
        id: testUuid(0x9c7),
        label: 'Backlash',
        description: 'When an attack hits the wolf, the wolf takes 5 damage.',
        order: 9,
        effects: [
          {
            id: testUuid(0x9c8),
            order: 1,
            invocation: {
              kind: 'ACTION',
              triggerCode: TRIGGER.ACTIVATED,
              activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
              reactionTrigger: { kind: 'ATTACKED_SELF' },
              range: { id: testUuid(0x9c9), rangeKind: RANGE_KIND.SELF },
              targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
            },
            paths: [
              {
                id: testUuid(0x9ca),
                order: 1,
                pathCode: PATH_CODE.ON_USE,
                groupType: PATH_GROUP_TYPE.SINGLE,
                originKind: 'SOURCE',
                selectionKind: 'FIXED',
                resultBlock: {
                  id: testUuid(0x9cb),
                  resultKind: 'SINGLE',
                  outcomes: [
                    {
                      id: testUuid(0x9cc),
                      effectKind: EFFECT_KIND.DAMAGE,
                      damageTypeId: biteDamageTypeId,
                      valueKind: 'FIXED',
                      scalingKind: 'NONE',
                      amount: 5
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  })
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('a reaction child that drops a creature to 0 hit points under a held action (QUALITY-18.T3d)', () => {
  it('raises that creature’s 0 hit point effect before the held action resumes', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: ATTACKER_ID, creature: attackBite }),
        srdCreatureActor({ id: REACTOR_ID, creature: backlashBurster, currentHitPoints: 1 }),
        srdCreatureActor({ id: BYSTANDER_ID, creature: plainWolf })
      ],
      ownerFeatureId: creatureFeature(attackBite, 'Bite').id
    })
    const stub = room.room.base.stub
    const bystanderBefore = readActorHitPoints(await readRoomHistory(stub), BYSTANDER_ID)
    const openOccurrences = async () =>
      (await readRoomHistory(stub)).occurrences
        .filter(({ state }) => state === 'PENDING' || state === 'SUSPENDED')
        .map(({ id, state }) => ({ id, state }))

    // The Bite hits the bursting Wolf by 1, and the hit is held for that Wolf's reaction.
    const started = await room.startAction(REACTOR_ID, [], room.sceneContext())
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    const attack = await room.pendingDecision()
    if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack prompt.')
    const context = await readPendingActionContext(stub)
    if (context.kind !== 'ENCOUNTER_ACTION' || !context.d20Policy)
      throw new Error('Expected a pending attack d20.')
    const rolled = await room.resolve(attack, {
      kind: 'ENTER_DICE',
      requestId: attack.pending.request.requestId,
      rawFaces: [context.d20Policy.dc + 1 - context.d20Policy.modifier],
      rollMode: attack.pending.request.rollMode
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const choice = await room.pendingDecision()
    if (choice.pending.kind !== 'REACTION_CHOICE')
      throw new Error(`Expected the reaction choice, got ${choice.pending.kind}.`)

    const used = await room.resolve(choice, {
      kind: 'OPTION',
      optionId: choice.pending.options[0]!.optionId
    })

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    // The reaction dropped the Wolf, and its burst waits on its saves while the Bite is still held.
    const held = await readRoomHistory(stub)
    expect(readActorHitPoints(held, REACTOR_ID)).toBe(0)
    const burst = await room.pendingDecision()
    expect(burst.pending.kind).toBe('AREA_SAVES')
    const open = await openOccurrences()
    expect(open).toHaveLength(2)
    expect(open).toContainEqual({ id: choice.occurrence.id, state: 'SUSPENDED' })
    expect(open).toContainEqual({ id: burst.occurrence.id, state: 'PENDING' })
    expect(readActorHitPoints(held, BYSTANDER_ID)).toBe(bystanderBefore)

    await answerAllSaves(room)

    // The burst settled, and only then did the Bite resume and commit: nothing is left open.
    expect(await openOccurrences()).toEqual([])
    const settled = await readRoomHistory(stub)
    expect(readActorHitPoints(settled, BYSTANDER_ID)).toBeLessThan(bystanderBefore)
    const actions = settled.commands.flatMap((row) => {
      if (row.commandType !== 'RESOLVE_ACTION') return []
      const { systemTrigger } = resolveEncounterActionInputDtoSchema.parse(
        JSON.parse(row.commandJson)
      )
      // A raised root that names no trigger is the default: reaching 0 hit points.
      const raisedBy = systemTrigger ? (systemTrigger.trigger ?? 'HP_ZERO') : 'COMMANDED'
      return [{ version: row.version, raisedBy }]
    })
    // In commit order: the reaction, the burst its commit raised, then the Bite it answered.
    expect(
      actions.sort((left, right) => left.version - right.version).map(({ raisedBy }) => raisedBy)
    ).toEqual(['REACTION', 'HP_ZERO', 'COMMANDED'])
  }, 120_000)
})
