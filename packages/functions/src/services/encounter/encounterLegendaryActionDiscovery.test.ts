import { describe, expect, it } from 'vitest'

import type { EncounterActorRecord, Json } from '@artificer-toolkit/db'
import { encounterActorRuleOutputSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { featureDtoSchema } from '@artificer-toolkit/schema/features/feature'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { discoverEncounterFeatureActionCapabilities } from '../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { createDnd5eCharacterActionRuntime } from '../rules/systems/dnd5e/characterActionRuntime.js'
import {
  createDnd5eLegendaryActionEligibilityDefinition,
  createDnd5eLegendaryActionLifecycleDefinition
} from '../rules/systems/dnd5e/encounterLifecyclePolicy.js'
import { DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID } from '../rules/systems/dnd5e/reactionEligibilityPolicy.js'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import {
  applyStagedLegendaryActionRefreshes,
  discoverEncounterLegendaryActionCandidates,
  stageEncounterLegendaryActionRefreshes
} from './encounterLegendaryActionDiscovery.js'
import { withFeatureChargeUsed } from './encounterActorState.js'

const ids = {
  owner: '00000000-0000-4000-8000-000000000201',
  outgoing: '00000000-0000-4000-8000-000000000202',
  source: '00000000-0000-4000-8000-000000000203',
  version: '00000000-0000-4000-8000-000000000204',
  user: '00000000-0000-4000-8000-000000000205',
  feature: '00000000-0000-4000-8000-000000000206',
  charge: '00000000-0000-4000-8000-000000000207',
  condition: '00000000-0000-4000-8000-000000000208',
  contribution: '00000000-0000-4000-8000-000000000209',
  occurrence: '00000000-0000-4000-8000-000000000210'
}

function current(input: {
  id: string
  family: string
  document: ReusableDefinitionCurrentDto['document']
  version?: number
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
    version: input.version ?? 1,
    publishedAt: '2026-08-29T00:00:00.000Z',
    publishedBy: ids.user
  }
}

function ownerActor(
  input: { conditions?: readonly string[]; used?: number } = {}
): EncounterActorRecord {
  const snapshot = {
    kind: 'CREATURE',
    id: '00000000-0000-4000-8000-000000000212',
    systemId: DND5E_SYSTEM_ID,
    sourceRevision: 1,
    sourceVersionId: ids.version,
    sourceChecksum: 'a'.repeat(64),
    payload: {
      features: [
        {
          id: ids.feature,
          label: 'Owner feature',
          description: '',
          order: 0,
          ruleDefinitionIds: ['00000000-0000-4000-8000-0000000000e2'],
          charges: {
            id: ids.charge,
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            resetKind: 'MANUAL',
            amount: 3
          },
          options: [1, 2, 3].map((cost) => ({
            id: `00000000-0000-4000-8000-00000000021${cost}`,
            label: `Action ${cost}`,
            description: '',
            order: cost,
            effects: [
              {
                id: `00000000-0000-4000-8000-00000000022${cost}`,
                order: 0,
                invocation: {
                  kind: 'ACTION',
                  triggerCode: 'ACTIVATED',
                  activation: { code: 'ACTION', amount: 1 },
                  range: { id: 'range', rangeKind: 'SELF' },
                  resourceUse: { chargeId: ids.charge, cost }
                },
                paths: [
                  {
                    id: `path-${cost}`,
                    order: 0,
                    pathCode: 'ON_USE',
                    groupType: 'SINGLE',
                    selectionKind: 'FIXED',
                    resultBlock: {
                      id: `result-${cost}`,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: `outcome-${cost}`,
                          effectKind: 'CONDITION',
                          conditionId: `condition-${cost}`
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }))
        }
      ]
    }
  }
  featureDtoSchema.parse(snapshot.payload.features[0])
  return {
    id: ids.owner,
    encounterId: '00000000-0000-4000-8000-000000000211',
    kind: 'CREATURE',
    sourceId: '00000000-0000-4000-8000-000000000212',
    sourceRevision: 1,
    label: 'Owner',
    systemId: DND5E_SYSTEM_ID,
    stableTieKey: 'owner',
    public: true,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: [...(input.conditions ?? [])],
    resources: { featureCharges: { [ids.feature]: input.used ?? 0 } },
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: snapshot as Json,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }
}

function actorRules(remaining = 3) {
  return encounterActorRuleOutputSchema.parse({
    actors: [
      {
        actorId: ids.owner,
        initiativeModifier: 0,
        targetProtection: { status: 'NOT_NORMALIZED' },
        featureResources: [
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
  input: { suppressAction?: boolean; staleGraph?: boolean; ambiguous?: boolean } = {}
) {
  const graph = createDnd5eLegendaryActionEligibilityDefinition()
  const lifecycle = createDnd5eLegendaryActionLifecycleDefinition()
  const graphRow = current({
    id: graph.id,
    family: graph.definitionFamilyKey,
    document: graph.definition,
    version: input.staleGraph ? 2 : 1
  })
  const lifecycleRow = current({
    id: lifecycle.id,
    family: 'dnd5e-encounter-lifecycle',
    document: lifecycle
  })
  const actionCapability = current({
    id: DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
    family: 'rule-capability',
    document: {
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
      gameSystemId: DND5E_SYSTEM_ID,
      usage: null
    }
  })
  const condition = current({
    id: ids.condition,
    family: 'condition-rule-state',
    document: {
      schemaVersion: 1,
      kind: 'CONDITION_RULE_STATE',
      id: ids.condition,
      gameSystemId: DND5E_SYSTEM_ID,
      capabilitySuppressions: input.suppressAction
        ? [
            {
              id: ids.contribution,
              order: 0,
              kind: 'CAPABILITY_SUPPRESS',
              capabilityDefinitionIds: [DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID]
            }
          ]
        : []
    }
  })
  const rows = new Map(
    [graphRow, lifecycleRow, actionCapability, condition].map((row) => [row.id, row])
  )
  if (input.ambiguous) {
    const additional = {
      ...lifecycle,
      id: '00000000-0000-4000-8000-000000000230'
    }
    rows.set(
      additional.id,
      current({
        id: additional.id,
        family: 'dnd5e-encounter-lifecycle',
        document: additional
      })
    )
  }
  return {
    graph,
    source: {
      async requireCurrent(definitionId: string) {
        const found = rows.get(definitionId)
        if (!found) throw new Error('Definition unavailable.')
        return found
      }
    },
    runtime: createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(4),
      definitions: {
        async requireCurrent(definitionId) {
          if (definitionId !== graph.id) throw new Error('Definition unavailable.')
          return graph
        }
      }
    })
  }
}

async function discover(
  input: {
    outgoingActorId?: string
    conditions?: readonly string[]
    remaining?: number
    windowUsed?: boolean
    staleGraph?: boolean
    ambiguous?: boolean
    unrelated?: boolean
    mismatchedOwnerCharge?: boolean
  } = {}
) {
  const state = fixture({
    staleGraph: input.staleGraph,
    ambiguous: input.ambiguous,
    suppressAction: input.conditions?.length === 1
  })
  const actor = ownerActor({ conditions: input.conditions })
  if (input.ambiguous) {
    const feature = (
      actor.snapshot as { payload: { features: Array<{ ruleDefinitionIds: string[] }> } }
    ).payload.features[0]!
    feature.ruleDefinitionIds.push('00000000-0000-4000-8000-000000000230')
  }
  if (input.unrelated) {
    const feature = (
      actor.snapshot as { payload: { features: Array<{ ruleDefinitionIds: string[] }> } }
    ).payload.features[0]!
    feature.ruleDefinitionIds.push(DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID)
    feature.ruleDefinitionIds.sort()
    featureDtoSchema.parse(feature)
  }
  const encounterFeatureCapabilities = discoverEncounterFeatureActionCapabilities({ actor })
  return discoverEncounterLegendaryActionCandidates({
    encounter: { actors: [actor], gameSystemId: DND5E_SYSTEM_ID },
    outgoingActorId: input.outgoingActorId ?? ids.outgoing,
    occurrenceId: ids.occurrence,
    actorRules: actorRules(input.remaining),
    encounterFeatureCapabilities: input.mismatchedOwnerCharge
      ? encounterFeatureCapabilities.map((capability) => ({
          ...capability,
          featureResourceUse:
            capability.featureResourceUse === null
              ? null
              : { ...capability.featureResourceUse, chargeId: ids.condition }
        }))
      : encounterFeatureCapabilities,
    lockedCharacters: new Map(),
    definitions: state.source,
    runtime: state.runtime,
    windowUsed: input.windowUsed
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

describe('Encounter Legendary Action discovery', () => {
  it('selects exact Feature-bound actions after another actor turn and retains deterministic pool evidence', async () => {
    await expect(discover()).resolves.toMatchObject([
      {
        ownerActorId: ids.owner,
        ownerFeatureId: ids.feature,
        featureCost: 1,
        poolBefore: 3,
        poolRemaining: 2,
        lifecycle: { resourceRecovery: 'FULL', maximumActionsPerWindow: 1 },
        eligibilityEvidence: {
          source: { definitionId: '00000000-0000-4000-8000-0000000000e1' }
        }
      },
      { featureCost: 2, poolBefore: 3, poolRemaining: 1 },
      { featureCost: 3, poolBefore: 3, poolRemaining: 0 }
    ])
  })

  it.each([
    ['same owner completed the turn', { outgoingActorId: ids.owner }],
    ['the action capability is UUID-suppressed', { conditions: [ids.condition] }],
    ['the Feature pool is empty', { remaining: 0 }],
    ['the window is already used', { windowUsed: true }]
  ])('returns no opportunity when %s', async (_label, input) => {
    await expect(discover(input)).resolves.toEqual([])
  })

  it('filters distinct authored costs without inferring a Feature cost', async () => {
    await expect(discover({ remaining: 2 })).resolves.toMatchObject([
      { featureCost: 1, poolBefore: 2, poolRemaining: 1 },
      { featureCost: 2, poolBefore: 2, poolRemaining: 0 }
    ])
  })

  it.each([
    ['source-charge pool', { limitKind: 'SOURCE_CHARGES', scalingKind: 'NONE', cost: 1 }],
    [
      'scaled fixed pool',
      {
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'PER_LEVEL',
        resetKind: 'MANUAL',
        levels: [{ id: '00000000-0000-4000-8000-000000000299', level: 1, amount: 3 }]
      }
    ]
  ])('fails closed for a %s', async (_label, charges) => {
    const state = fixture()
    const owner = ownerActor()
    const feature = (owner.snapshot as { payload: { features: Array<Record<string, unknown>> } })
      .payload.features[0]!
    feature.charges = { id: ids.charge, ...charges }
    featureDtoSchema.parse(feature)
    await expect(
      discoverEncounterLegendaryActionCandidates({
        encounter: { actors: [owner], gameSystemId: DND5E_SYSTEM_ID },
        outgoingActorId: ids.outgoing,
        occurrenceId: ids.occurrence,
        actorRules: actorRules(),
        encounterFeatureCapabilities: discoverEncounterFeatureActionCapabilities({ actor: owner }),
        lockedCharacters: new Map(),
        definitions: state.source,
        runtime: state.runtime
      })
    ).resolves.toEqual([])
  })

  it('discovers and settles a structured Feature action cost once', async () => {
    const state = fixture()
    const owner = ownerActor()
    const capabilities = discoverEncounterFeatureActionCapabilities({ actor: owner })
    const candidates = await discoverEncounterLegendaryActionCandidates({
      encounter: { actors: [owner], gameSystemId: DND5E_SYSTEM_ID },
      outgoingActorId: ids.outgoing,
      occurrenceId: ids.occurrence,
      actorRules: actorRules(),
      encounterFeatureCapabilities: capabilities,
      lockedCharacters: new Map(),
      definitions: sourceWithSeededFeatureDefinitions(state),
      runtime: state.runtime
    })
    const candidate = candidates.find((entry) => entry.featureCost === 1)
    expect(candidate).toMatchObject({
      ownerFeatureId: ids.feature,
      featureCost: 1,
      poolBefore: 3,
      poolRemaining: 2
    })
    if (!candidate) throw new Error('Expected a structured Legendary Action candidate.')

    const settledOwner = {
      ...owner,
      resources: withFeatureChargeUsed(owner, ids.feature, candidate.featureCost)
    }
    const replayState = ownerActor({ used: candidate.featureCost })
    expect(settledOwner.resources).toEqual(replayState.resources)
    await expect(
      discoverEncounterLegendaryActionCandidates({
        encounter: { actors: [replayState], gameSystemId: DND5E_SYSTEM_ID },
        outgoingActorId: ids.outgoing,
        occurrenceId: ids.occurrence,
        actorRules: actorRules(3 - candidate.featureCost),
        encounterFeatureCapabilities: discoverEncounterFeatureActionCapabilities({
          actor: replayState
        }),
        lockedCharacters: new Map(),
        definitions: sourceWithSeededFeatureDefinitions(state),
        runtime: state.runtime
      })
    ).resolves.toContainEqual(
      expect.objectContaining({
        ownerFeatureId: ids.feature,
        poolBefore: 3 - candidate.featureCost
      })
    )
  })

  it('discovers and settles the authored structured action cost of two', async () => {
    const state = fixture()
    const owner = ownerActor()
    const candidates = await discoverEncounterLegendaryActionCandidates({
      encounter: { actors: [owner], gameSystemId: DND5E_SYSTEM_ID },
      outgoingActorId: ids.outgoing,
      occurrenceId: ids.occurrence,
      actorRules: actorRules(),
      encounterFeatureCapabilities: discoverEncounterFeatureActionCapabilities({ actor: owner }),
      lockedCharacters: new Map(),
      definitions: sourceWithSeededFeatureDefinitions(state),
      runtime: state.runtime
    })
    const candidate = candidates.find((entry) => entry.featureCost === 2)
    expect(candidate).toMatchObject({
      ownerFeatureId: ids.feature,
      featureCost: 2,
      poolBefore: 3,
      poolRemaining: 1
    })
    if (!candidate) throw new Error('Expected structured cost-two Legendary Action candidate.')

    const settledOwner = {
      ...owner,
      resources: withFeatureChargeUsed(owner, ids.feature, candidate.featureCost)
    }
    expect(settledOwner.resources).toEqual(ownerActor({ used: 2 }).resources)
  })

  it('refreshes only the exact fixed owner pool at the owner START_OF_TURN boundary', async () => {
    const state = fixture()
    const owner = ownerActor({ used: 2 })
    const staged = await stageEncounterLegendaryActionRefreshes({
      actorId: ids.owner,
      encounter: { actors: [owner], gameSystemId: DND5E_SYSTEM_ID },
      actorRules: actorRules(1),
      definitions: state.source
    })
    expect(staged.refreshes).toHaveLength(1)
    expect(owner.resources).toEqual(ownerActor({ used: 2 }).resources)
    const [refreshed] = await applyStagedLegendaryActionRefreshes({
      encounter: { actors: [owner], gameSystemId: DND5E_SYSTEM_ID },
      definitions: state.source,
      refreshes: staged.refreshes
    })
    expect(refreshed?.resources).toEqual(ownerActor({ used: 0 }).resources)
    const staleOwner = {
      ...owner,
      resources: withFeatureChargeUsed(owner, ids.feature, 1)
    }
    await expect(
      applyStagedLegendaryActionRefreshes({
        encounter: { actors: [staleOwner], gameSystemId: DND5E_SYSTEM_ID },
        definitions: state.source,
        refreshes: staged.refreshes
      })
    ).rejects.toThrow('Legendary Action refresh owner is stale')
    await expect(
      discoverEncounterLegendaryActionCandidates({
        encounter: { actors: [refreshed!], gameSystemId: DND5E_SYSTEM_ID },
        outgoingActorId: ids.outgoing,
        occurrenceId: ids.occurrence,
        actorRules: actorRules(3),
        encounterFeatureCapabilities: discoverEncounterFeatureActionCapabilities({
          actor: refreshed!
        }),
        lockedCharacters: new Map(),
        definitions: state.source,
        runtime: state.runtime
      })
    ).resolves.toHaveLength(3)
  })

  it('fails closed for a stale or ambiguous lifecycle graph binding', async () => {
    await expect(discover({ staleGraph: true })).rejects.toThrow('graph pin is stale')
    await expect(discover({ ambiguous: true })).rejects.toThrow(
      'ambiguous Legendary Action lifecycle bindings'
    )
  })

  it('ignores an unrelated valid definition while retaining the exact Legendary lifecycle', async () => {
    await expect(discover({ unrelated: true })).resolves.toHaveLength(3)
  })

  it('fails closed when an action resource binding no longer matches its owner Feature charge', async () => {
    await expect(discover({ mismatchedOwnerCharge: true })).rejects.toThrow(
      'resource binding is stale'
    )
  })
})
