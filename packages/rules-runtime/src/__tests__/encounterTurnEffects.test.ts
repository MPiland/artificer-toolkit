import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from '../systems/dnd5e/identity.js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { EncounterResponseAnswer } from '../encounterEvidenceAnswer.js'
import { prepareEncounterTurnEffects } from '../encounterTurnEffects.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import {
  activeEffect,
  GOBLIN,
  GOBLIN_SCALARS,
  turnSaveDamageEffect,
  type TurnSaveDamageEffectInput
} from './encounterActiveEffectFixtures.js'

const GOBLIN_ID = testUuid(0x201)
const OCCURRENCE_ID = testUuid(0x202)
const ROOT_COMMAND_ID = testUuid(0x203)
const APP_ROLL_ID = testUuid(0x204)
const GM_USER_ID = testUuid(0x9a)
const BOUNDARY = { ordinal: 1, stage: 'START_OF_TURN', actorId: GOBLIN_ID } as const
const goblin = srdCreatureActor({ id: GOBLIN_ID, creature: GOBLIN })
const OWNER = {
  kind: 'ENCOUNTER_ACTOR',
  encounterId: ENCOUNTER_ID,
  targetActorId: GOBLIN_ID
} as const

let runtime: RulesRuntimeService
beforeAll(async () => {
  runtime = createSrdRulesRuntime()
})

function effect(seed: number, input: Partial<TurnSaveDamageEffectInput> = {}) {
  return turnSaveDamageEffect({
    runtime,
    seed,
    target: goblin,
    damage: 1,
    saveDc: 30,
    ticks: 3,
    ...input
  })
}

/** Two effects in store order; the second is created after the first. */
async function effectPair(first: Partial<TurnSaveDamageEffectInput>, second = first) {
  const earlier = await effect(1, first)
  return [earlier, await effect(2, { ...second, currentEffects: [earlier] })] as const
}

const root = turnCoordinatorRootDtoSchema.parse({
  rootCommandId: ROOT_COMMAND_ID,
  commandFingerprint: 'f'.repeat(64),
  commandType: 'ADVANCE_TURN',
  initiatorUserId: GM_USER_ID,
  requestedByUserId: GM_USER_ID,
  correlationId: null,
  expectedEncounterVersion: 7,
  proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: GOBLIN_ID },
  resolutionCommands: []
})

/** The Goblin's pinned Dexterity save: +2 from Dexterity 14 against the effect's DC 30. */
const DEX_SAVE_POLICY = {
  requestNodeId: 'd20',
  rollMode: 'NORMAL',
  keep: 'FIRST',
  contributors: [],
  contributorChecksum: checksumRuleDocument([]),
  modifier: 2,
  dc: 30,
  savingThrowAbilityDefinitionId: DND5E_ABILITY_DEFINITION_ID_BY_CODE.DEXTERITY
}

/** The turn-effect selection identity, in createdOrdinal order. */
function selectionChecksum(effects: readonly ActiveRuleEffectRecord[]) {
  return checksumCanonicalJson({
    commandType: 'ADVANCE_TURN',
    boundaries: effects.map((value) => ({
      boundaryOrdinal: 1,
      stage: 'START_OF_TURN',
      targetActorId: GOBLIN_ID,
      owner: OWNER,
      activeEffectId: value.id,
      createdOrdinal: value.createdOrdinal
    }))
  })
}

function targetStateChecksum(currentHitPoints: number) {
  return checksumRuleDocument({
    targetActorId: GOBLIN_ID,
    currentHitPoints,
    temporaryHitPoints: 0,
    maximumHitPoints: 7,
    scalarValues: GOBLIN_SCALARS,
    conditionIds: []
  })
}

function candidate(
  ordinal: number,
  value: ActiveRuleEffectRecord,
  stateChecksum: string,
  d20Policy: typeof DEX_SAVE_POLICY | null
) {
  return {
    ordinal,
    boundaryOrdinal: 1,
    stage: 'START_OF_TURN',
    targetActorId: GOBLIN_ID,
    owner: { kind: 'ENCOUNTER_ACTOR' },
    activeEffectId: value.id,
    createdOrdinal: value.createdOrdinal,
    effectVersion: 1,
    definitionChecksum: value.definitionChecksum,
    lifecycleChecksum: value.lifecycleChecksum,
    targetStateChecksum: stateChecksum,
    d20Policy
  }
}

/** Serves each scripted face once and records how many were drawn. */
function scriptedD20(faces: readonly number[]) {
  const queue = [...faces]
  const roll = () => {
    const face = queue.shift()
    if (face === undefined) throw new Error('No scripted d20 face remains.')
    return face
  }
  return { roll, remaining: () => queue.length }
}

function prepare(input: {
  effects: readonly ActiveRuleEffectRecord[]
  /** The turn's creature; the plain Goblin by default. */
  actor?: EncounterRunActorState
  state?: EncounterRunState
  autoRoll?: boolean
  faces?: readonly number[]
  boundary?: { ordinal: 0 | 1; stage: 'START_OF_TURN' | 'END_OF_TURN'; actorId: string | null }
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: EncounterResponseAnswer
}) {
  const actor = input.actor ?? goblin
  const state = input.state ?? srdEncounterState({ actors: [actor], currentActorId: GOBLIN_ID })
  const d20 = scriptedD20(input.faces ?? [])
  const calls = { listEffects: 0, createRuntime: 0 }
  const result = prepareEncounterTurnEffects({
    state,
    listEffects: async (owner) => {
      calls.listEffects += 1
      expect(owner).toEqual(OWNER)
      return [...input.effects]
    },
    loadMaintainedState: () => Promise.reject(new Error('No maintained state is loaded.')),
    loadTarget: async (actorId) => {
      expect(actorId).toBe(GOBLIN_ID)
      return srdCreatureTarget(actor, [...input.effects])
    },
    createRuntime: async () => {
      calls.createRuntime += 1
      return runtime
    },
    random: (maxExclusive) => {
      expect(maxExclusive).toBe(20)
      return d20.roll() - 1
    },
    resolvePerception: async () => null,
    userId: GM_USER_ID,
    autoRoll: input.autoRoll ?? true,
    root,
    occurrenceId: OCCURRENCE_ID,
    actors: [actor],
    boundary: input.boundary ?? BOUNDARY,
    ...(input.pending ? { pending: input.pending } : {}),
    ...(input.resolution ? { resolution: input.resolution } : {})
  })
  return { result, calls, remainingFaces: d20.remaining }
}

function creatureHitPoints(actors: readonly EncounterRunActorState[]) {
  return actors.map((actor) => (actor.kind === 'CHARACTER' ? null : actor.currentHitPoints))
}

async function complete(run: ReturnType<typeof prepare>) {
  const result = await run.result
  if (result.kind !== 'COMPLETE') throw new Error('Expected a completed turn-effect phase.')
  return result
}

async function pending(run: ReturnType<typeof prepare>) {
  const result = await run.result
  if (result.kind !== 'PENDING') throw new Error('Expected pending turn-effect evidence.')
  return result.snapshot
}

describe('prepareEncounterTurnEffects', () => {
  it('completes with no phase when no effect recurs at the boundary', async () => {
    const endOfTurn = await effect(1, { recurrenceStage: 'END_OF_TURN' })
    const run = prepare({ effects: [endOfTurn] })

    expect(await run.result).toEqual({
      kind: 'COMPLETE',
      actors: [goblin],
      movementTargets: new Map(),
      plan: null,
      phase: { kind: 'NONE' }
    })
    expect(run.calls).toEqual({ listEffects: 1, createRuntime: 0 })

    const noActor = prepare({ effects: [endOfTurn], boundary: { ...BOUNDARY, actorId: null } })
    expect((await complete(noActor)).phase).toEqual({ kind: 'NONE' })
    expect(noActor.calls).toEqual({ listEffects: 0, createRuntime: 0 })
  })

  it('records a MANUAL review phase over the exact createdOrdinal-ordered selection', async () => {
    const [earlier, later] = await effectPair({})
    const run = prepare({
      effects: [later, earlier],
      state: srdEncounterState({
        actors: [goblin],
        currentActorId: GOBLIN_ID,
        automationMode: 'MANUAL'
      })
    })

    const result = await complete(run)

    expect([earlier.createdOrdinal, later.createdOrdinal]).toEqual([1, 2])
    expect(result.plan).toBeNull()
    expect(result.actors).toEqual([goblin])
    expect(result.phase).toEqual({
      kind: 'MANUAL',
      selectionChecksum: selectionChecksum([earlier, later]),
      result: {
        status: 'MANUAL',
        initiative: null,
        initiativeAdvance: null,
        occurrenceId: OCCURRENCE_ID,
        occurrenceVersion: 1
      }
    })
    expect(run.calls.createRuntime).toBe(0)
  })

  it('decrements tick lifecycles, expires the last tick and stages the next boundary target', async () => {
    const [ticking, lastTick] = await effectPair({ ticks: 3 }, { ticks: 1 })
    const run = prepare({ effects: [ticking, lastTick], faces: [10, 10] })

    const result = await complete(run)

    expect(result.plan?.executions.map((execution) => execution.lifecycle)).toEqual([
      {
        kind: 'UPDATE',
        expectedVersion: 1,
        afterVersion: 2,
        beforeRemainingTicks: 3,
        afterRemainingTicks: 2,
        beforeLifecycleChecksum: ticking.lifecycleChecksum,
        // The effect store checksums a lifecycle update with canonical JSON.
        afterLifecycleChecksum: checksumCanonicalJson({ schemaVersion: 1, remainingTicks: 2 })
      },
      {
        kind: 'EXPIRE',
        expectedVersion: 1,
        beforeRemainingTicks: 1,
        afterRemainingTicks: 0,
        beforeLifecycleChecksum: lastTick.lifecycleChecksum
      }
    ])
    expect(
      result.movementTargets.get(GOBLIN_ID)?.activeEffects.map((value) => ({
        id: value.id,
        version: value.version,
        lifecycle: value.lifecycle
      }))
    ).toEqual([{ id: ticking.id, version: 2, lifecycle: { schemaVersion: 1, remainingTicks: 2 } }])
    expect(run.remainingFaces()).toBe(0)
  })

  it('counts down an effect that also ends on an event, leaving the event to its consumer', async () => {
    const ending = await effect(1, { ticks: 3, endOnEvents: ['ON_ATTACK_ROLL', 'ON_CAST_SPELL'] })
    const run = prepare({ effects: [ending], faces: [10] })

    const result = await complete(run)

    expect(result.plan?.executions.map((execution) => execution.lifecycle)).toMatchObject([
      { kind: 'UPDATE', beforeRemainingTicks: 3, afterRemainingTicks: 2 }
    ])
  })

  it('ends the holder’s damage-triggered effect, releasing its condition, when the damage lands (SPELLS-27.T4b)', async () => {
    const invisible = SRD_CONDITION_TYPES.find(({ code }) => code === 'INVISIBLE')!.id
    const ticking = await effect(1, { damage: 2 })
    const sleeper = activeEffect({
      id: testUuid(0x2f1),
      owner: OWNER,
      createdOrdinal: 9,
      endOnTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }],
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: invisible, baselinePresent: false }
      ]
    })
    const unseen = srdCreatureActor({ id: GOBLIN_ID, creature: GOBLIN, conditionIds: [invisible] })

    const result = await complete(
      prepare({ actor: unseen, effects: [ticking, sleeper], faces: [10] })
    )

    const [execution] = result.plan?.executions ?? []
    expect(execution?.applications.map(({ kind }) => kind)).toEqual(['DAMAGE', 'CONDITION_REMOVE'])
    expect(execution?.targetTransition.after.conditionIds).not.toContain(invisible)
    expect(execution?.targetTransition.after.currentHitPoints).toBe(5)
  })

  it('expires a later recurring effect that the damage ends, releasing its condition (SPELLS-27.T4b)', async () => {
    const invisible = SRD_CONDITION_TYPES.find(({ code }) => code === 'INVISIBLE')!.id
    const ticking = await effect(1, { damage: 2 })
    const sleeping = await effect(2, {
      damage: 1,
      currentEffects: [ticking],
      conditionOwnership: [{ conditionId: invisible, baselinePresent: false }],
      endOnTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }]
    })
    const unseen = srdCreatureActor({ id: GOBLIN_ID, creature: GOBLIN, conditionIds: [invisible] })

    const result = await complete(
      prepare({ actor: unseen, effects: [ticking, sleeping], faces: [10, 10] })
    )

    const executions = result.plan?.executions ?? []
    expect(executions.map(({ lifecycle }) => lifecycle.kind)).toEqual(['UPDATE', 'EXPIRE'])
    expect(executions[0]?.applications.map(({ kind }) => kind)).toEqual([
      'DAMAGE',
      'CONDITION_REMOVE'
    ])
    expect(executions[1]?.targetTransition.after.conditionIds).not.toContain(invisible)
  })

  it('auto-rolls each failed save in createdOrdinal order and chains the damage through both effects', async () => {
    const [heavier, lighter] = await effectPair({ damage: 2 }, { damage: 1 })
    const run = prepare({ effects: [lighter, heavier], faces: [10, 4] })

    const result = await complete(run)

    const executions = result.plan?.executions ?? []
    expect(result.plan?.selectionChecksum).toBe(selectionChecksum([heavier, lighter]))
    expect(executions.map((execution) => [execution.ordinal, execution.activeEffectId])).toEqual([
      [0, heavier.id],
      [1, lighter.id]
    ])
    expect(
      executions.map((execution) => [
        execution.targetTransition.before.currentHitPoints,
        execution.targetTransition.after.currentHitPoints
      ])
    ).toEqual([
      [7, 5],
      [5, 4]
    ])
    // Goblin Dexterity 14 saves at +2 against the pinned DC 30.
    expect(
      executions.map((execution) => ({
        rawFaces: execution.d20?.rawFaces,
        total: execution.d20?.total,
        defenseOrDc: execution.d20?.defenseOrDc,
        resultPath: execution.d20?.resultPath
      }))
    ).toEqual([
      { rawFaces: [10], total: 12, defenseOrDc: 30, resultPath: 'ON_SAVE_FAIL' },
      { rawFaces: [4], total: 6, defenseOrDc: 30, resultPath: 'ON_SAVE_FAIL' }
    ])
    expect(creatureHitPoints(result.actors)).toEqual([4])
    expect(result.phase).toEqual({ kind: 'STAGED', plan: result.plan })
    expect(run.remainingFaces()).toBe(0)
  })

  it('pauses for each save when the roller does not auto-roll, then resumes with entered and app-rolled dice', async () => {
    const [heavier, lighter] = await effectPair({ damage: 2 }, { damage: 1 })
    const effects = [heavier, lighter]

    const firstPause = await pending(prepare({ effects, autoRoll: false }))
    const firstContext = firstPause.applicationContext
    if (firstContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
      throw new Error('Expected turn-effect evidence.')
    const fullHealth = targetStateChecksum(7)
    expect(firstContext.selectionChecksum).toBe(selectionChecksum(effects))
    expect(firstContext.root).toEqual(root)
    expect(firstContext.currentCandidate).toEqual(
      candidate(0, heavier, fullHealth, DEX_SAVE_POLICY)
    )
    expect(firstContext.completedExecutions).toEqual([])
    // Every candidate is issued against the state before the paused effect runs.
    expect(firstContext.remainingCandidates).toEqual([candidate(1, lighter, fullHealth, null)])

    if (firstPause.snapshotKind !== 'KERNEL_EVIDENCE') throw new Error('Expected kernel evidence.')
    const secondRun = prepare({
      effects,
      autoRoll: false,
      pending: firstPause,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: firstPause.request.requestId,
        rawFaces: [3],
        rollMode: 'NORMAL'
      }
    })
    const secondPause = await pending(secondRun)
    const secondContext = secondPause.applicationContext
    if (secondContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
      throw new Error('Expected turn-effect evidence.')
    // The second save is issued against the Goblin after the first effect's 2 damage.
    expect(secondContext.currentCandidate).toEqual(
      candidate(1, lighter, targetStateChecksum(5), DEX_SAVE_POLICY)
    )
    expect(
      secondContext.completedExecutions.map((value) => ({
        activeEffectId: value.activeEffectId,
        rawFaces: value.d20?.rawFaces,
        hitPoints: value.targetTransition.after.currentHitPoints
      }))
    ).toEqual([{ activeEffectId: heavier.id, rawFaces: [3], hitPoints: 5 }])
    expect(secondContext.remainingCandidates).toEqual([])

    if (secondPause.snapshotKind !== 'KERNEL_EVIDENCE') throw new Error('Expected kernel evidence.')
    const finalRun = prepare({
      effects,
      autoRoll: false,
      pending: secondPause,
      resolution: {
        kind: 'SYSTEM_ROLL',
        requestId: secondPause.request.requestId,
        rollId: APP_ROLL_ID,
        faces: [5],
        rollMode: 'NORMAL',
        keep: 'FIRST'
      }
    })
    const result = await complete(finalRun)
    expect(result.plan?.executions.map((value) => value.d20?.rawFaces)).toEqual([[3], [5]])
    expect(creatureHitPoints(result.actors)).toEqual([4])
    expect(finalRun.remainingFaces()).toBe(0)
  })

  it('takes no damage on a successful save but still spends a tick of a damage-only effect', async () => {
    const saved = await effect(1, { saveDc: 10, damage: 2 })
    const run = prepare({ effects: [saved], faces: [15] })

    const result = await complete(run)

    const execution = result.plan?.executions[0]
    expect(execution?.d20).toMatchObject({
      rawFaces: [15],
      total: 17,
      resultPath: 'ON_SAVE_SUCCESS'
    })
    expect(execution?.applications).toEqual([])
    expect(execution?.targetTransition.after).toEqual(execution?.targetTransition.before)
    expect(execution?.lifecycle).toMatchObject({
      kind: 'UPDATE',
      beforeRemainingTicks: 3,
      afterRemainingTicks: 2
    })
    expect(creatureHitPoints(result.actors)).toEqual([7])
  })

  it('refuses an effect whose tick expiration decrements at another stage', async () => {
    const ticking = await effect(1)
    const mismatched: ActiveRuleEffectRecord = {
      ...ticking,
      definition: {
        ...ticking.definition,
        recurrence: {
          ...ticking.definition.recurrence,
          expiration: {
            kind: 'TICKS',
            initialRemaining: 3,
            decrementStage: 'END_OF_TURN',
            anchor: 'HOLDER'
          }
        }
      }
    }
    const run = prepare({ effects: [mismatched], faces: [10] })

    await expect(run.result).rejects.toThrow(new Error('Turn effect recurrence is unsupported.'))
    expect(run.remainingFaces()).toBe(1)
  })
})
