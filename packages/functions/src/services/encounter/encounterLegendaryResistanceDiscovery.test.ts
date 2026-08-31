import { describe, expect, it, vi } from 'vitest'

import type { EncounterActorRecord, Json } from '@artificer-toolkit/db'
import { encounterActorRuleOutputSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { featureDtoSchema } from '@artificer-toolkit/schema/features/feature'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  createDnd5eLegendaryResistanceChoiceDefinition,
  createDnd5eLegendaryResistanceLifecycleDefinition
} from '../rules/systems/dnd5e/encounterLifecyclePolicy.js'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import { createDnd5eCharacterActionRuntime } from '../rules/systems/dnd5e/characterActionRuntime.js'
import {
  resumeEncounterLegendaryResistanceChoice,
  startEncounterLegendaryResistanceChoice
} from './encounterLegendaryResistanceChoice.js'
import { discoverEncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import { withFeatureChargeUsed } from './encounterActorState.js'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000501',
  actor: '00000000-0000-4000-8000-000000000502',
  source: '00000000-0000-4000-8000-000000000503',
  version: '00000000-0000-4000-8000-000000000504',
  feature: '00000000-0000-4000-8000-000000000505',
  charge: '00000000-0000-4000-8000-000000000506',
  user: '00000000-0000-4000-8000-000000000507',
  occurrence: '00000000-0000-4000-8000-000000000508'
}

function current(input: {
  id: string
  family: string
  document: ReusableDefinitionCurrentDto['document']
  gameSystemId?: string
  version?: number
  checksum?: string
}): ReusableDefinitionCurrentDto {
  return {
    id: input.id,
    gameSystemId: input.gameSystemId ?? DND5E_SYSTEM_ID,
    contentSourceId: ids.source,
    definitionFamilyKey: input.family,
    label: 'Fixture',
    description: null,
    document: input.document,
    checksum: input.checksum ?? checksumRuleDocument(input.document),
    contractVersion: 1,
    version: input.version ?? 1,
    publishedAt: '2026-08-29T00:00:00.000Z',
    publishedBy: ids.user
  }
}

function actor(
  input: {
    remaining?: number
    additionalLifecycleId?: string
    unrelatedDefinitionId?: string
  } = {}
): EncounterActorRecord {
  const feature = {
    id: ids.feature,
    label: 'Resistance',
    description: '',
    order: 0,
    ruleDefinitionIds: [
      '00000000-0000-4000-8000-0000000000e4',
      ...(input.additionalLifecycleId ? [input.additionalLifecycleId] : []),
      ...(input.unrelatedDefinitionId ? [input.unrelatedDefinitionId] : [])
    ],
    charges: {
      id: ids.charge,
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    }
  }
  featureDtoSchema.parse(feature)
  return {
    id: ids.actor,
    encounterId: ids.encounter,
    kind: 'CREATURE',
    sourceId: ids.source,
    sourceRevision: 1,
    label: 'Target',
    systemId: DND5E_SYSTEM_ID,
    stableTieKey: 'target',
    public: true,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    resources: { featureCharges: { [ids.feature]: 3 - (input.remaining ?? 3) } },
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {
      kind: 'CREATURE',
      id: ids.source,
      systemId: DND5E_SYSTEM_ID,
      sourceRevision: 1,
      sourceVersionId: ids.version,
      sourceChecksum: 'a'.repeat(64),
      payload: { features: [feature] }
    } as Json,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }
}

function rules(input: { remaining?: number; unavailable?: boolean } = {}) {
  const remaining = input.remaining ?? 3
  return encounterActorRuleOutputSchema.parse({
    actors: [
      {
        actorId: ids.actor,
        initiativeModifier: 0,
        targetProtection: { status: 'NOT_NORMALIZED' },
        featureResources: input.unavailable
          ? []
          : [
              {
                featureId: ids.feature,
                maximum: 3,
                reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                rawUsed: 3 - remaining,
                used: 3 - remaining,
                remaining,
                resetKind: 'MANUAL'
              }
            ]
      }
    ]
  })
}

function fixture(
  input: {
    staleGraph?: boolean
    crossSystem?: boolean
    invalidChecksum?: boolean
    ambiguous?: boolean
    unrelated?: boolean
  } = {}
) {
  const graph = createDnd5eLegendaryResistanceChoiceDefinition()
  const lifecycle = createDnd5eLegendaryResistanceLifecycleDefinition()
  const graphRow = current({
    id: graph.id,
    family: graph.definitionFamilyKey,
    document: graph.definition,
    version: input.staleGraph ? 2 : 1,
    gameSystemId: input.crossSystem ? ids.source : DND5E_SYSTEM_ID
  })
  const lifecycleRow = current({
    id: lifecycle.id,
    family: 'dnd5e-encounter-lifecycle',
    document: lifecycle,
    checksum: input.invalidChecksum ? 'b'.repeat(64) : undefined
  })
  const rows = new Map<string, ReusableDefinitionCurrentDto>([
    [graphRow.id, graphRow],
    [lifecycleRow.id, lifecycleRow]
  ])
  let additionalLifecycleId: string | undefined
  let unrelatedDefinitionId: string | undefined
  if (input.ambiguous) {
    additionalLifecycleId = '00000000-0000-4000-8000-000000000509'
    rows.set(
      additionalLifecycleId,
      current({
        id: additionalLifecycleId,
        family: 'dnd5e-encounter-lifecycle',
        document: { ...lifecycle, id: additionalLifecycleId }
      })
    )
  }
  if (input.unrelated) {
    unrelatedDefinitionId = '00000000-0000-4000-8000-000000000510'
    rows.set(
      unrelatedDefinitionId,
      current({
        id: unrelatedDefinitionId,
        family: 'rule-capability',
        document: {
          schemaVersion: 1,
          kind: 'RULE_CAPABILITY',
          id: unrelatedDefinitionId,
          gameSystemId: DND5E_SYSTEM_ID,
          usage: null
        }
      })
    )
  }
  return {
    actor: actor({ additionalLifecycleId, unrelatedDefinitionId }),
    graph,
    source: {
      async requireCurrent(definitionId: string) {
        const found = rows.get(definitionId)
        if (!found) throw new Error('Definition unavailable.')
        return found
      }
    }
  }
}

async function discover(
  input: Parameters<typeof fixture>[0] & {
    remaining?: number
    unavailable?: boolean
  } = {}
) {
  const state = fixture(input)
  return discoverEncounterLegendaryResistanceCandidate({
    encounter: { gameSystemId: DND5E_SYSTEM_ID },
    targetActor:
      input.remaining === undefined ? state.actor : actor({ remaining: input.remaining }),
    actorRules: rules({ remaining: input.remaining, unavailable: input.unavailable }),
    definitions: state.source
  })
}

function runtime() {
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(7),
    definitions: {
      async requireCurrent() {
        throw new Error('Not used.')
      }
    }
  })
}

function sourceWithSeededFeatureDefinitions(state: ReturnType<typeof fixture>) {
  return {
    async requireCurrent(definitionId: string) {
      try {
        return await state.source.requireCurrent(definitionId)
      } catch {
        return current({
          id: definitionId,
          family: 'unrelated-seeded-feature-definition',
          document: {
            schemaVersion: 1,
            kind: 'RULE_CAPABILITY',
            id: definitionId,
            gameSystemId: DND5E_SYSTEM_ID,
            usage: null
          }
        })
      }
    }
  }
}

describe('Encounter Legendary Resistance discovery', () => {
  it('discovers one exact Feature lifecycle and its current charge pool', async () => {
    await expect(discover()).resolves.toMatchObject({
      targetActorId: ids.actor,
      ownerFeatureId: ids.feature,
      chargeId: ids.charge,
      featureCost: 1,
      poolBefore: 3,
      poolRemaining: 2,
      lifecycle: {
        replacement: 'SAVE_SUCCESS',
        interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME'
      }
    })
  })

  it.each([
    ['has no remaining charge', { remaining: 0 }],
    ['has an unavailable Feature resource', { unavailable: true }]
  ])('skips when the source %s', async (_label, input) => {
    await expect(discover(input)).resolves.toBeNull()
  })

  it('skips Character and Custom targets without consulting definition state', async () => {
    const state = fixture()
    const requireCurrent = vi.fn(state.source.requireCurrent)
    const base = state.actor
    for (const kind of ['CHARACTER', 'CUSTOM'] as const) {
      await expect(
        discoverEncounterLegendaryResistanceCandidate({
          encounter: { gameSystemId: DND5E_SYSTEM_ID },
          targetActor: { ...base, kind },
          actorRules: rules(),
          definitions: { requireCurrent }
        })
      ).resolves.toBeNull()
    }
    expect(requireCurrent).not.toHaveBeenCalled()
  })

  it('skips a Creature snapshot with no normalized Features', async () => {
    const state = fixture()
    const requireCurrent = vi.fn(state.source.requireCurrent)
    const targetActor = {
      ...state.actor,
      snapshot: {
        ...(state.actor.snapshot as { payload: Record<string, unknown> }),
        payload: { features: [] }
      } as Json
    }
    await expect(
      discoverEncounterLegendaryResistanceCandidate({
        encounter: { gameSystemId: DND5E_SYSTEM_ID },
        targetActor,
        actorRules: rules(),
        definitions: { requireCurrent }
      })
    ).resolves.toBeNull()
    expect(requireCurrent).not.toHaveBeenCalled()
  })

  it('consumes exactly one from the fixed Feature-owned pool', async () => {
    await expect(discover({ remaining: 3 })).resolves.toMatchObject({
      featureCost: 1,
      poolBefore: 3,
      poolRemaining: 2
    })
    await expect(discover({ remaining: 0 })).resolves.toBeNull()
  })

  it('discovers the structured fixed Feature pool and preserves one settled use for replay', async () => {
    const state = fixture()
    const targetActor = actor()
    const candidate = await discoverEncounterLegendaryResistanceCandidate({
      encounter: { gameSystemId: DND5E_SYSTEM_ID },
      targetActor,
      actorRules: rules(),
      definitions: sourceWithSeededFeatureDefinitions(state)
    })
    expect(candidate).toMatchObject({
      ownerFeatureId: ids.feature,
      chargeId: ids.charge,
      featureCost: 1,
      poolBefore: 3,
      poolRemaining: 2
    })

    const settledActor = {
      ...targetActor,
      resources: withFeatureChargeUsed(targetActor, ids.feature, 1)
    }
    const replayState = actor({ remaining: 2 })
    expect(settledActor.resources).toEqual(replayState.resources)
    await expect(
      discoverEncounterLegendaryResistanceCandidate({
        encounter: { gameSystemId: DND5E_SYSTEM_ID },
        targetActor: replayState,
        actorRules: rules({ remaining: 2 }),
        definitions: sourceWithSeededFeatureDefinitions(state)
      })
    ).resolves.toMatchObject({ poolBefore: 2, featureCost: 1 })
  })

  it('rejects cross-System, stale, checksum-invalid, and ambiguous bindings', async () => {
    await expect(discover({ crossSystem: true })).rejects.toThrow('choice graph pin is stale')
    await expect(discover({ staleGraph: true })).rejects.toThrow('choice graph pin is stale')
    await expect(discover({ invalidChecksum: true })).rejects.toThrow('checksum is invalid')
    await expect(discover({ ambiguous: true })).rejects.toThrow('ambiguous Legendary Resistance')
  })

  it('skips unrelated definition families on the exact Feature', async () => {
    await expect(discover({ unrelated: true })).resolves.toMatchObject({
      ownerFeatureId: ids.feature,
      lifecycle: { replacement: 'SAVE_SUCCESS' }
    })
  })

  it('settles DECLINE and USE to the exact pinned graph evidence', async () => {
    const candidate = await discover()
    if (!candidate) throw new Error('Expected Legendary Resistance candidate.')
    const decline = await resumeEncounterLegendaryResistanceChoice({
      runtime: runtime(),
      continuation: await startEncounterLegendaryResistanceChoice({
        runtime: runtime(),
        occurrenceId: ids.occurrence,
        candidate
      }),
      candidate,
      selection: 'DECLINE'
    })
    expect(decline).toMatchObject({ selectedIndex: 0, use: false, lifecycle: candidate.lifecycle })
    const useRuntime = runtime()
    const use = await resumeEncounterLegendaryResistanceChoice({
      runtime: useRuntime,
      continuation: await startEncounterLegendaryResistanceChoice({
        runtime: useRuntime,
        occurrenceId: ids.occurrence,
        candidate
      }),
      candidate,
      selection: 'USE'
    })
    expect(use).toMatchObject({ selectedIndex: 1, use: true, lifecycle: candidate.lifecycle })
    expect(use.execution.evidence.source).toMatchObject({
      definitionId: candidate.lifecycle.choiceGraphDefinitionId,
      checksum: candidate.lifecycle.choiceGraphDefinitionChecksum
    })
  })

  it('rejects a stale choice continuation before resuming the kernel', async () => {
    const candidate = await discover()
    if (!candidate) throw new Error('Expected Legendary Resistance candidate.')
    const rulesRuntime = runtime()
    const continuation = await startEncounterLegendaryResistanceChoice({
      runtime: rulesRuntime,
      occurrenceId: ids.occurrence,
      candidate
    })
    await expect(
      resumeEncounterLegendaryResistanceChoice({
        runtime: rulesRuntime,
        continuation: {
          ...continuation,
          graph: {
            ...continuation.graph,
            source: { ...continuation.graph.source, checksum: 'c'.repeat(64) }
          }
        },
        candidate,
        selection: 'USE'
      })
    ).rejects.toThrow('continuation pin is stale')
  })
})
