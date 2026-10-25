import { describe, expect, it, vi } from 'vitest'
import { prepareEncounterTurnEffects } from '@artificer-toolkit/rules-runtime/encounterTurnEffects'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { TurnEffectBoundary } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  plannedThresholdDefinition,
  type RepeatSaveAttempts
} from '@artificer-toolkit/rules-runtime/testing/repeatSaveThresholdsFixture'
import {
  CAMPAIGN_ID,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureTarget,
  SRD_SYSTEM_ID,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  actors,
  GM_USER_ID,
  GOBLIN_ID,
  OCCURRENCE_ID,
  root
} from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveEffectSaveTally } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { createActiveRuleEffectStore } from '../effectStore.js'
import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget
} from '../mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import { persistEncounterTurnEffects } from '../turnEffectsPersistence.js'

const OCCURRED_AT = '2026-10-17T00:00:00.000Z'
const COMMAND_ID = '00000000-0000-4000-8000-0000000c0001'
const BOUNDARY: TurnEffectBoundary = { ordinal: 0, stage: 'END_OF_TURN', actorId: GOBLIN_ID }
const PASS = 20
const FAIL = 1
const STALE_LIFECYCLE = 'Staged turn effect lifecycle is invalid.'
const state = srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 })
const goblin = actors.find((actor) => actor.id === GOBLIN_ID)!
const runtime = createSrdRulesRuntime()

/** A memory store holding the Run and its actors, with one threshold-counted effect on the goblin. */
async function seeded(attempts: RepeatSaveAttempts, saveTally: ActiveEffectSaveTally) {
  const memory = createMemoryEncounterStore()
  // The only cast: the host ports are the platform, and the wider port surface is unused here.
  // turnZoneEffectsPersistence.test.ts builds its transaction the same way.
  const ctx = {
    db: memory.store,
    ports: {
      requireIdentity: async () => ({ userId: GM_USER_ID }),
      requireCampaignAuthority: async () => ({
        campaign: {
          id: CAMPAIGN_ID,
          status: 'ACTIVE',
          gameSystemId: SRD_SYSTEM_ID,
          ownerUserId: GM_USER_ID
        }
      }),
      readCharacterRow: async () => ({
        status: 'ACTIVE',
        systemId: SRD_SYSTEM_ID,
        play: { streamVersion: 1 }
      })
    }
  } as unknown as EncounterCharacterWriteTransaction
  const run = encounterRunStateSchema.parse(state)
  await memory.store.insert('encounterRuns', {
    id: run.id,
    campaignId: run.campaignId,
    gameSystemId: run.gameSystemId,
    status: run.status,
    version: run.version,
    stateJson: JSON.stringify(run),
    stateChecksum: checksumCanonicalJson(run),
    createCommandId: COMMAND_ID,
    createCommandFingerprint: 'b'.repeat(64),
    concentrationCasterCharacterIds: [],
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
  for (const actor of actors) await insertRunActor(ctx, actor)
  const owner = turnEffectOwner(goblin, ENCOUNTER_ID)
  const store = createActiveRuleEffectStore(ctx)
  const planned = await plannedThresholdDefinition(attempts, GOBLIN_ID)
  const effect = await store.create({
    id: testUuid(0x4a1),
    owner,
    definition: {
      ...planned,
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: ENCOUNTER_ID,
        sourceOccurrenceId: OCCURRENCE_ID,
        rootCommandId: root.rootCommandId,
        sourceActorId: GOBLIN_ID
      }
    },
    lifecycle: { schemaVersion: 1, remainingTicks: 10, saveTally }
  })
  return { ctx, store, owner, effect }
}

/** The goblin's end-of-turn save, answered with `face`, as the room stages it from real product code. */
async function stagedPhase(scene: Awaited<ReturnType<typeof seeded>>, face: number) {
  const prepared = await prepareEncounterTurnEffects({
    state,
    listEffects: async () => scene.store.list(scene.owner),
    loadMaintainedState: () => Promise.reject(new Error('No maintained state is loaded.')),
    loadTarget: async (actorId) =>
      srdCreatureTarget(
        actors.find((actor) => actor.id === actorId)!,
        await scene.store.list(scene.owner)
      ),
    createRuntime: async () => runtime,
    random: () => face - 1,
    resolvePerception: async () => null,
    userId: GM_USER_ID,
    autoRollByActorId: Object.fromEntries(actors.map(({ id }) => [id, true])),
    root,
    occurrenceId: OCCURRENCE_ID,
    actors,
    boundary: BOUNDARY
  })
  if (prepared.kind !== 'COMPLETE' || prepared.phase.kind !== 'STAGED')
    throw new Error('Expected a staged turn-effect phase.')
  return prepared.phase
}

type Phase = Awaited<ReturnType<typeof stagedPhase>>

/** The same phase with its one execution claiming `afterSaveTally`, its checksum made to match. */
function claiming(
  scene: Awaited<ReturnType<typeof seeded>>,
  phase: Phase,
  afterSaveTally: ActiveEffectSaveTally
): Phase {
  const claimed = structuredClone(phase)
  const [execution] = claimed.plan.executions
  if (execution?.lifecycle.kind !== 'UPDATE') throw new Error('Expected a lifecycle update.')
  execution.lifecycle.afterSaveTally = afterSaveTally
  execution.lifecycle.afterLifecycleChecksum = checksumRuleDocument({
    ...scene.effect.lifecycle,
    remainingTicks: execution.lifecycle.afterRemainingTicks,
    saveTally: afterSaveTally
  })
  return claimed
}

function persist(scene: Awaited<ReturnType<typeof seeded>>, phase: Phase) {
  const applyMechanics = vi.fn(
    async (batch: Parameters<Parameters<typeof persistEncounterTurnEffects>[2]>[0]) => {
      const target = await readEncounterMechanicsBatchTarget(scene.ctx, {
        ...batch,
        expectedCharacterStreamVersion: null
      })
      const plan = planEncounterMechanicsBatch({
        batch: target.input,
        actor: target.actor,
        userId: target.userId
      })
      return persistEncounterMechanicsBatchPlan(scene.ctx, target, {
        actor: target.actor,
        character: null,
        plan
      })
    }
  )
  return persistEncounterTurnEffects(
    scene.ctx,
    {
      state,
      userId: GM_USER_ID,
      occurrenceId: OCCURRENCE_ID,
      occurrenceVersion: 1,
      rootCommandId: root.rootCommandId,
      occurredAt: OCCURRED_AT,
      boundary: BOUNDARY,
      phase
    },
    applyMechanics
  )
}

const COUNTED = { successesToEnd: 3, failuresToResolve: 3, consecutive: false }
const CONSECUTIVE = { ...COUNTED, consecutive: true }

describe('persisting a threshold-counted turn effect (SPELLS-4.T2m1c)', () => {
  it('stores a one-save tally step with the checksum its lifecycle hashes to', async () => {
    const scene = await seeded(COUNTED, { successes: 1, failures: 1 })
    const phase = await stagedPhase(scene, FAIL)

    await persist(scene, phase)

    const [stored] = await scene.store.list(scene.owner)
    expect(stored?.lifecycle).toMatchObject({
      remainingTicks: 9,
      saveTally: { successes: 1, failures: 2 }
    })
    expect(stored?.version).toBe(scene.effect.version + 1)
    expect(stored?.lifecycleChecksum).toBe(checksumRuleDocument(stored?.lifecycle))
  })

  it('zeroes the other count only when the thresholds are consecutive', async () => {
    const scene = await seeded(CONSECUTIVE, { successes: 2, failures: 0 })
    const phase = await stagedPhase(scene, FAIL)

    await persist(scene, phase)

    const [stored] = await scene.store.list(scene.owner)
    expect(stored?.lifecycle.saveTally).toEqual({ successes: 0, failures: 1 })
  })

  it('refuses a plan that jumps the tally by two saves', async () => {
    const scene = await seeded(COUNTED, { successes: 1, failures: 1 })
    const phase = claiming(scene, await stagedPhase(scene, FAIL), { successes: 1, failures: 3 })

    await expect(persist(scene, phase)).rejects.toThrow(STALE_LIFECYCLE)
    const [stored] = await scene.store.list(scene.owner)
    expect(stored?.lifecycle.saveTally).toEqual({ successes: 1, failures: 1 })
  })

  it('refuses a non-consecutive tally that loses the other count', async () => {
    const scene = await seeded(COUNTED, { successes: 0, failures: 2 })
    const phase = claiming(scene, await stagedPhase(scene, PASS), { successes: 1, failures: 0 })

    await expect(persist(scene, phase)).rejects.toThrow(STALE_LIFECYCLE)
    const [stored] = await scene.store.list(scene.owner)
    expect(stored?.lifecycle.saveTally).toEqual({ successes: 0, failures: 2 })
  })
})
