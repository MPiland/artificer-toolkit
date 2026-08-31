import { describe, expect, it, vi } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'
import { encounterActorRuleOutputSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { featureDtoSchema } from '@artificer-toolkit/schema/features/feature'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { createDnd5eCharacterActionRuntime } from '../rules/systems/dnd5e/characterActionRuntime.js'
import {
  createDnd5eRechargeDefinition,
  createDnd5eRechargeLifecycleDefinition
} from '../rules/systems/dnd5e/encounterLifecyclePolicy.js'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import {
  discoverEncounterRechargeCandidates,
  executeEncounterRechargeCandidate
} from './encounterRechargeLifecycle.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000011',
  feature: '00000000-0000-4000-8000-000000000012',
  occurrence: '00000000-0000-4000-8000-000000000013',
  source: '00000000-0000-4000-8000-000000000014',
  version: '00000000-0000-4000-8000-000000000015',
  user: '00000000-0000-4000-8000-000000000016'
}

function current(input: {
  id: string
  document: ReusableDefinitionCurrentDto['document']
  family: string
}): ReusableDefinitionCurrentDto {
  return {
    id: input.id,
    gameSystemId: DND5E_SYSTEM_ID,
    contentSourceId: ids.source,
    definitionFamilyKey: input.family,
    label: 'Fixture',
    description: null,
    document: input.document,
    checksum: checksumRuleDocument(input.document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-08-29T00:00:00.000Z',
    publishedBy: ids.user
  }
}

function definitions(threshold: 5 | 6 = 5) {
  const graph = createDnd5eRechargeDefinition(threshold)
  const lifecycle = createDnd5eRechargeLifecycleDefinition(threshold)
  const rows = new Map<string, ReusableDefinitionCurrentDto>([
    [
      graph.id,
      current({ id: graph.id, document: graph.definition, family: graph.definitionFamilyKey })
    ],
    [
      lifecycle.id,
      current({ id: lifecycle.id, document: lifecycle, family: 'dnd5e-encounter-lifecycle' })
    ]
  ])
  return {
    graph,
    lifecycle,
    source: {
      async requireCurrent(definitionId: string) {
        const found = rows.get(definitionId)
        if (!found) throw new Error('Definition unavailable.')
        return found
      }
    }
  }
}

function actor(ruleDefinitionIds: string[]): EncounterActorRecord {
  return {
    id: ids.actor,
    encounterId: '00000000-0000-4000-8000-000000000021',
    kind: 'CREATURE',
    sourceId: '00000000-0000-4000-8000-000000000022',
    sourceRevision: 1,
    label: 'Creature',
    systemId: DND5E_SYSTEM_ID,
    stableTieKey: 'creature',
    public: true,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    resources: { featureCharges: { [ids.feature]: 2 } },
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {
      kind: 'CREATURE',
      id: '00000000-0000-4000-8000-000000000022',
      systemId: DND5E_SYSTEM_ID,
      sourceRevision: 1,
      sourceVersionId: ids.version,
      sourceChecksum: 'a'.repeat(64),
      payload: {
        features: [
          {
            id: ids.feature,
            label: 'Breath',
            description: '',
            order: 0,
            ruleDefinitionIds,
            charges: { id: 'charges', limitKind: 'SOURCE_CHARGES', scalingKind: 'NONE', cost: 1 }
          }
        ]
      }
    },
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }
}

function actorRules() {
  return encounterActorRuleOutputSchema.parse({
    actors: [
      {
        actorId: ids.actor,
        initiativeModifier: 0,
        targetProtection: { status: 'NOT_NORMALIZED' },
        featureResources: [
          {
            featureId: ids.feature,
            maximum: 3,
            reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
            rawUsed: 2,
            used: 2,
            remaining: 1,
            resetKind: 'MANUAL'
          }
        ]
      }
    ]
  })
}

function runtime(graph: ReturnType<typeof createDnd5eRechargeDefinition>) {
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(7),
    definitions: {
      async requireCurrent(definitionId) {
        return definitionId === graph.id ? graph : null
      }
    }
  })
}

describe('Encounter recharge lifecycle', () => {
  it('discovers only one exact UUID-bound depleted Feature policy', async () => {
    const fixture = definitions()
    expect(
      dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(fixture.lifecycle)
        .success
    ).toBe(true)
    const fixtureActor = actor([fixture.lifecycle.id])
    const parsedFeature = featureDtoSchema.safeParse(
      (fixtureActor.snapshot as { payload: { features: unknown[] } }).payload.features[0]
    )
    expect(parsedFeature.success).toBe(true)
    const discovered = await discoverEncounterRechargeCandidates({
      actorId: ids.actor,
      encounterActors: [fixtureActor],
      actorRules: actorRules(),
      definitions: fixture.source
    })
    expect(discovered).toMatchObject([
      {
        actorId: ids.actor,
        featureId: ids.feature,
        beforeUsed: 2,
        maximum: 3,
        policy: { definitionId: fixture.lifecycle.id, graphDefinitionId: fixture.graph.id }
      }
    ])
  })

  it('fails closed when the Feature policy is missing or ambiguous', async () => {
    const fixture = definitions()
    await expect(
      discoverEncounterRechargeCandidates({
        actorId: ids.actor,
        encounterActors: [actor([])],
        actorRules: actorRules(),
        definitions: fixture.source
      })
    ).resolves.toEqual([])
    const additional = definitions(6)
    const source = {
      async requireCurrent(definitionId: string) {
        return definitionId === fixture.graph.id || definitionId === fixture.lifecycle.id
          ? fixture.source.requireCurrent(definitionId)
          : additional.source.requireCurrent(definitionId)
      }
    }
    await expect(
      discoverEncounterRechargeCandidates({
        actorId: ids.actor,
        encounterActors: [actor([fixture.lifecycle.id, additional.lifecycle.id])],
        actorRules: actorRules(),
        definitions: source
      })
    ).rejects.toThrow('ambiguous recharge lifecycle bindings')
  })

  it('uses automatic d6 evidence and recovers fully only after a successful pinned result', async () => {
    const fixture = definitions(5)
    const [candidate] = await discoverEncounterRechargeCandidates({
      actorId: ids.actor,
      encounterActors: [actor([fixture.lifecycle.id])],
      actorRules: actorRules(),
      definitions: fixture.source
    })
    const rollD6 = vi.fn(() => 5)
    const result = await executeEncounterRechargeCandidate({
      candidate: candidate!,
      occurrenceId: ids.occurrence,
      definitions: fixture.source,
      runtime: runtime(fixture.graph),
      mode: 'AUTOMATIC',
      rollD6
    })
    expect(result).toMatchObject({ kind: 'COMPLETE', recharged: true, afterUsed: 0, rawDie: 5 })
    expect(rollD6).toHaveBeenCalledOnce()
  })

  it('pauses Assisted recharge and validates exact raw d6 evidence before recovery', async () => {
    const fixture = definitions(6)
    const [candidate] = await discoverEncounterRechargeCandidates({
      actorId: ids.actor,
      encounterActors: [actor([fixture.lifecycle.id])],
      actorRules: actorRules(),
      definitions: fixture.source
    })
    const actionRuntime = runtime(fixture.graph)
    const pending = await executeEncounterRechargeCandidate({
      candidate: candidate!,
      occurrenceId: ids.occurrence,
      definitions: fixture.source,
      runtime: actionRuntime,
      mode: 'ASSISTED'
    })
    expect(pending).toMatchObject({ kind: 'PENDING' })
    if (!pending || pending.kind !== 'PENDING') throw new Error('Expected pending recharge.')
    await expect(
      executeEncounterRechargeCandidate({
        candidate: candidate!,
        occurrenceId: ids.occurrence,
        definitions: fixture.source,
        runtime: actionRuntime,
        mode: 'ASSISTED',
        continuation: pending.continuation,
        rawDie: 5
      })
    ).resolves.toMatchObject({ kind: 'COMPLETE', recharged: false, afterUsed: 2, rawDie: 5 })
  })

  it('leaves recharge inert in Manual mode without runtime evaluation', async () => {
    const fixture = definitions()
    const [candidate] = await discoverEncounterRechargeCandidates({
      actorId: ids.actor,
      encounterActors: [actor([fixture.lifecycle.id])],
      actorRules: actorRules(),
      definitions: fixture.source
    })
    const actionRuntime = runtime(fixture.graph)
    await expect(
      executeEncounterRechargeCandidate({
        candidate: candidate!,
        occurrenceId: ids.occurrence,
        definitions: fixture.source,
        runtime: actionRuntime,
        mode: 'MANUAL'
      })
    ).resolves.toBeNull()
  })

  it('does not discover an explicit rest-recovery Feature as a d6 recharge source', async () => {
    const feature = {
      id: '00000000-0000-4000-8000-000000000031',
      label: 'Rest Recovery Fixture',
      description: '',
      order: 0,
      charges: {
        id: '00000000-0000-4000-8000-000000000032',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        resetKind: 'SHORT_REST',
        amount: 1
      }
    }
    featureDtoSchema.parse(feature)
    const sourceActor: EncounterActorRecord = {
      ...actor([]),
      sourceId: '00000000-0000-4000-8000-000000000033',
      label: 'Rest Recovery Fixture',
      resources: { featureCharges: { [feature.id]: 1 } },
      snapshot: {
        kind: 'CREATURE',
        id: '00000000-0000-4000-8000-000000000033',
        systemId: DND5E_SYSTEM_ID,
        sourceRevision: 1,
        sourceVersionId: ids.version,
        sourceChecksum: 'a'.repeat(64),
        payload: { features: [feature] }
      }
    }
    const sourceRules = encounterActorRuleOutputSchema.parse({
      actors: [
        {
          actorId: sourceActor.id,
          initiativeModifier: 0,
          targetProtection: { status: 'NOT_NORMALIZED' },
          featureResources: [
            {
              featureId: feature.id,
              maximum: 1,
              reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
              rawUsed: 1,
              used: 1,
              remaining: 0,
              resetKind: 'LONG_REST'
            }
          ]
        }
      ]
    })
    const fixture = definitions()
    await expect(
      discoverEncounterRechargeCandidates({
        actorId: sourceActor.id,
        encounterActors: [sourceActor],
        actorRules: sourceRules,
        definitions: fixture.source
      })
    ).resolves.toEqual([])
  })
})
