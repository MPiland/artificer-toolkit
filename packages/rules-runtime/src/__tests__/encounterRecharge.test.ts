import { describe, expect, it, vi } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_DND5E_RECHARGE_5_GRAPH_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'

import { featureChargeUsed } from '../encounterActorState.js'
import {
  discoverEncounterRechargeCandidates,
  executeEncounterRechargeCandidate,
  type EncounterRechargeCandidate
} from '../encounterRechargeLifecycle.js'
import { prepareEncounterTurnRecharge } from '../encounterTurnRecharge.js'
import {
  createSrdRulesRuntime,
  creatureFeature,
  SRD_SYSTEM_ID,
  srdActorRules,
  srdCreatureActor,
  srdDefinitions,
  srdEncounterState
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'

const hellHound = srdByLabel(SRD.creatures, 'Hell Hound')
const wolf = srdByLabel(SRD.creatures, 'Wolf')

const HOUND_ID = '00000000-0000-4000-8000-00000000a001'
const WOLF_ID = '00000000-0000-4000-8000-00000000a002'
const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000a003'
const fireBreath = creatureFeature(hellHound, 'Fire Breath (Recharge 5-6)')

/** A Hell Hound, which has spent its Fire Breath (Recharge 5–6) unless told otherwise. */
function hound(fireBreathUsed = 1) {
  return srdCreatureActor({
    id: HOUND_ID,
    creature: hellHound,
    featureCharges: { [fireBreath.id]: fireBreathUsed }
  })
}

async function discover(actorId: string, actors: readonly EncounterRunActorState[]) {
  return discoverEncounterRechargeCandidates({
    actorId,
    encounterActors: actors,
    actorRules: srdActorRules(actors),
    definitions: srdDefinitions
  })
}

async function fireBreathCandidate(): Promise<EncounterRechargeCandidate> {
  const [candidate] = await discover(HOUND_ID, [hound()])
  if (!candidate) throw new Error('Expected the spent Fire Breath to be a Recharge candidate.')
  return candidate
}

async function execute(
  input: Omit<
    Parameters<typeof executeEncounterRechargeCandidate>[0],
    'occurrenceId' | 'definitions' | 'runtime'
  >
) {
  return executeEncounterRechargeCandidate({
    ...input,
    occurrenceId: OCCURRENCE_ID,
    definitions: srdDefinitions,
    runtime: await createSrdRulesRuntime()
  })
}

describe('Recharge candidate discovery', () => {
  it('pins the spent Recharge 5–6 Feature of the Creature whose turn is starting', async () => {
    const lifecycle = await srdDefinitions.requireCurrent(DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID)
    const graph = await srdDefinitions.requireCurrent(SRD_DND5E_RECHARGE_5_GRAPH_DEFINITION_ID)
    expect(
      await discover(HOUND_ID, [hound(), srdCreatureActor({ id: WOLF_ID, creature: wolf })])
    ).toEqual([
      {
        actorId: HOUND_ID,
        featureId: fireBreath.id,
        featureVersionChecksum: checksumRuleDocument(fireBreath),
        policy: {
          gameSystemId: SRD_SYSTEM_ID,
          definitionId: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
          definitionVersion: 1,
          definitionChecksum: lifecycle.checksum,
          graphDefinitionId: SRD_DND5E_RECHARGE_5_GRAPH_DEFINITION_ID,
          graphDefinitionVersion: 1,
          graphDefinitionChecksum: graph.checksum,
          rechargedOutput: 'recharged'
        },
        beforeUsed: 1,
        maximum: 1
      }
    ])
  })

  it('offers nothing for an unspent ability or at another actor’s turn start', async () => {
    expect(await discover(HOUND_ID, [hound(0)])).toEqual([])
    // SRD: the Recharge roll happens at the start of the monster's own turn only.
    expect(
      await discover(WOLF_ID, [hound(), srdCreatureActor({ id: WOLF_ID, creature: wolf })])
    ).toEqual([])
  })
})

describe('Recharge d6 execution', () => {
  it('recharges Recharge 5–6 on a 5 or 6 only', async () => {
    const candidate = await fireBreathCandidate()
    const outcomes = []
    for (const die of [1, 2, 3, 4, 5, 6]) {
      const result = await execute({ candidate, mode: 'AUTO_ROLL', rollD6: () => die })
      if (result?.kind !== 'COMPLETE') throw new Error('An auto-rolled Recharge must complete.')
      expect(result.execution.outputs).toEqual({ recharged: result.recharged })
      outcomes.push({
        rawDie: result.rawDie,
        recharged: result.recharged,
        afterUsed: result.afterUsed
      })
    }
    expect(outcomes).toEqual([
      { rawDie: 1, recharged: false, afterUsed: 1 },
      { rawDie: 2, recharged: false, afterUsed: 1 },
      { rawDie: 3, recharged: false, afterUsed: 1 },
      { rawDie: 4, recharged: false, afterUsed: 1 },
      { rawDie: 5, recharged: true, afterUsed: 0 },
      { rawDie: 6, recharged: true, afterUsed: 0 }
    ])
  })

  it('rolls the auto-rolled d6 exactly once and keeps a failed die', async () => {
    const candidate = await fireBreathCandidate()
    const rollD6 = vi.fn(() => 4)
    const result = await execute({ candidate, mode: 'AUTO_ROLL', rollD6 })
    expect(rollD6).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      kind: 'COMPLETE',
      candidate,
      recharged: false,
      afterUsed: 1,
      rawDie: 4
    })
  })

  it('prompts for the d6 and settles the entered die against the sealed request', async () => {
    const candidate = await fireBreathCandidate()
    const pending = await execute({ candidate, mode: 'PROMPT', rollD6: () => 6 })
    if (pending?.kind !== 'PENDING') throw new Error('A prompted Recharge must wait for its die.')
    expect(pending.candidate).toEqual(candidate)
    expect(pending.continuation.occurrenceId).toBe(OCCURRENCE_ID)
    expect(pending.continuation.request).toMatchObject({ kind: 'INTEGER_RANGE', min: 1, max: 6 })

    const failed = await execute({
      candidate,
      mode: 'PROMPT',
      continuation: pending.continuation,
      rawDie: 4
    })
    expect(failed).toMatchObject({ kind: 'COMPLETE', recharged: false, afterUsed: 1, rawDie: 4 })
    const recharged = await execute({
      candidate,
      mode: 'PROMPT',
      continuation: pending.continuation,
      rawDie: 5
    })
    expect(recharged).toMatchObject({ kind: 'COMPLETE', recharged: true, afterUsed: 0, rawDie: 5 })
  })

  it('resolves nothing in a Manual Encounter', async () => {
    const rollD6 = vi.fn(() => 6)
    expect(
      await execute({ candidate: await fireBreathCandidate(), mode: 'MANUAL', rollD6 })
    ).toBeNull()
    expect(rollD6).not.toHaveBeenCalled()
  })

  it('refuses a die outside 1–6 and evidence without a matching request', async () => {
    const candidate = await fireBreathCandidate()
    await expect(execute({ candidate, mode: 'AUTO_ROLL', rollD6: () => 7 })).rejects.toThrow(
      'Recharge die must be an integer from 1 to 6.'
    )
    await expect(execute({ candidate, mode: 'PROMPT', rawDie: 5 })).rejects.toThrow(
      'Recharge has no pending evidence request.'
    )
    await expect(execute({ candidate, mode: 'AUTO_ROLL' })).rejects.toThrow(
      'Automatic recharge evidence is required.'
    )
    const pending = await execute({ candidate, mode: 'PROMPT' })
    if (pending?.kind !== 'PENDING') throw new Error('A prompted Recharge must wait for its die.')
    await expect(
      execute({ candidate, mode: 'PROMPT', continuation: pending.continuation })
    ).rejects.toThrow('Assisted recharge evidence is required.')
  })
})

describe('start-of-turn Recharge phase', () => {
  function root(currentActorId: string | null) {
    return turnCoordinatorRootDtoSchema.parse({
      rootCommandId: '00000000-0000-4000-8000-00000000a010',
      commandFingerprint: 'b'.repeat(64),
      commandType: 'ADVANCE_TURN',
      initiatorUserId: '00000000-0000-4000-8000-00000000a011',
      requestedByUserId: '00000000-0000-4000-8000-00000000a011',
      correlationId: null,
      expectedEncounterVersion: 7,
      proposedTerminalTransition: { status: 'ACTIVE', round: 2, currentActorId }
    })
  }

  async function prepare(input: {
    currentActorId: string | null
    autoRoll: boolean
    rollD6: () => number
    automationMode?: AutomationModeDto
    turnRoot?: ReturnType<typeof root>
    pending?: Parameters<typeof prepareEncounterTurnRecharge>[0]['pending']
    rawDie?: number
  }) {
    const actors = [hound(), srdCreatureActor({ id: WOLF_ID, creature: wolf })]
    return prepareEncounterTurnRecharge({
      state: srdEncounterState({
        actors,
        currentActorId: WOLF_ID,
        ...(input.automationMode ? { automationMode: input.automationMode } : {})
      }),
      root: input.turnRoot ?? root(input.currentActorId),
      occurrenceId: OCCURRENCE_ID,
      actors,
      autoRoll: input.autoRoll,
      definitions: srdDefinitions,
      createRuntime: createSrdRulesRuntime,
      rollD6: input.rollD6,
      ...(input.pending ? { pending: input.pending } : {}),
      ...(input.rawDie === undefined ? {} : { rawDie: input.rawDie })
    })
  }

  function houndFireBreathUsed(actors: readonly EncounterRunActorState[]) {
    const actor = actors.find((entry) => entry.id === HOUND_ID)
    if (!actor) throw new Error('The Hell Hound is missing.')
    return featureChargeUsed(actor, fireBreath.id)
  }

  it('rolls when the Creature’s own turn starts and stages the recovered charge', async () => {
    const candidate = await fireBreathCandidate()
    const rollD6 = vi.fn(() => 5)
    const result = await prepare({ currentActorId: HOUND_ID, autoRoll: true, rollD6 })
    if (result.kind !== 'COMPLETE' || !result.plan) throw new Error('Expected a completed plan.')
    expect(rollD6).toHaveBeenCalledTimes(1)
    expect(result.plan.selectionChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(result.plan.executions).toHaveLength(1)
    expect(result.plan.executions[0]).toMatchObject({
      ordinal: 0,
      candidate: { ...candidate, ordinal: 0 },
      recharged: true,
      beforeUsed: 1,
      afterUsed: 0,
      rawDie: 5
    })
    expect(houndFireBreathUsed(result.actors)).toBe(0)
  })

  it('keeps a failed die spent: the charge stays used and a retained plan never re-rolls', async () => {
    const first = await prepare({ currentActorId: HOUND_ID, autoRoll: true, rollD6: () => 4 })
    if (first.kind !== 'COMPLETE' || !first.plan) throw new Error('Expected a completed plan.')
    expect(first.plan.executions[0]).toMatchObject({ recharged: false, afterUsed: 1, rawDie: 4 })
    expect(houndFireBreathUsed(first.actors)).toBe(1)

    const rollD6 = vi.fn(() => 6)
    const replayed = await prepare({
      currentActorId: HOUND_ID,
      autoRoll: true,
      rollD6,
      turnRoot: { ...root(HOUND_ID), completedRechargePlan: first.plan }
    })
    expect(rollD6).not.toHaveBeenCalled()
    expect(replayed).toEqual(first)
  })

  it('refuses a retained plan whose die was changed after the fact', async () => {
    const first = await prepare({ currentActorId: HOUND_ID, autoRoll: true, rollD6: () => 4 })
    if (first.kind !== 'COMPLETE' || !first.plan) throw new Error('Expected a completed plan.')
    const [execution] = first.plan.executions
    if (!execution) throw new Error('Expected one Recharge execution.')
    await expect(
      prepare({
        currentActorId: HOUND_ID,
        autoRoll: true,
        rollD6: () => 6,
        turnRoot: {
          ...root(HOUND_ID),
          completedRechargePlan: { ...first.plan, executions: [{ ...execution, rawDie: 5 }] }
        }
      })
    ).rejects.toThrow('Retained Recharge execution is stale.')
  })

  it('waits for a prompting roller, then settles the entered die without rolling', async () => {
    const rollD6 = vi.fn(() => 6)
    const pending = await prepare({ currentActorId: HOUND_ID, autoRoll: false, rollD6 })
    if (pending.kind !== 'PENDING') throw new Error('A prompting roller must be asked for the d6.')
    const candidate = await fireBreathCandidate()
    expect(pending.snapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_TURN_RECHARGE',
      phase: 'START_OF_TURN',
      completedExecutions: [],
      currentCandidate: { ...candidate, ordinal: 0 },
      remainingCandidates: []
    })

    const settled = await prepare({
      currentActorId: HOUND_ID,
      autoRoll: false,
      rollD6,
      pending: pending.snapshot,
      rawDie: 4
    })
    expect(rollD6).not.toHaveBeenCalled()
    if (settled.kind !== 'COMPLETE' || !settled.plan) throw new Error('Expected a completed plan.')
    expect(settled.plan.executions[0]).toMatchObject({ recharged: false, afterUsed: 1, rawDie: 4 })
    expect(houndFireBreathUsed(settled.actors)).toBe(1)
  })

  it('plans nothing at another actor’s turn, at the end of combat, or in a Manual Encounter', async () => {
    for (const input of [
      { currentActorId: WOLF_ID },
      { currentActorId: null },
      { currentActorId: HOUND_ID, automationMode: 'MANUAL' as const }
    ]) {
      const rollD6 = vi.fn(() => 6)
      const result = await prepare({ ...input, autoRoll: true, rollD6 })
      expect(result).toEqual({ kind: 'COMPLETE', plan: null, actors: expect.any(Array) })
      if (result.kind === 'COMPLETE') expect(houndFireBreathUsed(result.actors)).toBe(1)
      expect(rollD6).not.toHaveBeenCalled()
    }
  })

  it('refuses a die entered without a pending request', async () => {
    await expect(
      prepare({ currentActorId: HOUND_ID, autoRoll: false, rollD6: () => 6, rawDie: 5 })
    ).rejects.toThrow('Recharge evidence has no pending request.')
  })
})
