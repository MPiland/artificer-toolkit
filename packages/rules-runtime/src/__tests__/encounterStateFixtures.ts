import type {
  ActiveRuleEffectOwner,
  ActiveRuleEffectRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

export const ENCOUNTER_ID = '00000000-0000-4000-8000-00000000b001'
export const SIDE_ID = '00000000-0000-4000-8000-00000000b002'
export const TIMESTAMP = '2026-09-26T00:00:00.000Z'

type Ability = keyof typeof SRD_ABILITY_DEFINITION_IDS
type StateContribution = Extract<
  ActiveRuleEffectDefinitionDto,
  { schemaVersion: 2 }
>['stateContributions'][number]

/** Normalized SRD Creature rule facts, as a Blueprint snapshot pins them. */
export function creatureRuleFacts(scores: Record<Ability, number>) {
  return {
    gameSystemId: SRD_SYSTEM_ID,
    vocabularySnapshotId: '00000000-0000-4000-8000-00000000b003',
    vocabularySnapshotVersion: 1,
    vocabularySnapshotChecksum: 'b'.repeat(64),
    abilityScores: Object.fromEntries(
      Object.entries(scores).map(([code, score]) => [
        SRD_ABILITY_DEFINITION_IDS[code as Ability],
        score
      ])
    ),
    resourceAbilityScores: {},
    initiativeAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
  }
}

/** A Run-owned SRD Creature actor; `snapshot` is the Blueprint snapshot it was admitted with. */
export function creatureActor(input: {
  id: string
  kind?: 'CREATURE' | 'CUSTOM'
  snapshot: Record<string, unknown>
  currentHitPoints?: number
  maxHitPoints?: number
  tempHitPoints?: number
  conditions?: unknown[]
}): EncounterRunActorState {
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: input.kind ?? 'CREATURE',
    label: 'Bandit',
    sourceId: null,
    sourceRevision: null,
    public: true,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    initiative: null,
    manualOrder: null,
    healthDisplay: null,
    systemId: SRD_SYSTEM_ID,
    stableTieKey: input.id,
    currentHitPoints: input.currentHitPoints ?? 11,
    maxHitPoints: input.maxHitPoints ?? 11,
    tempHitPoints: input.tempHitPoints ?? 0,
    conditions: input.conditions ?? [],
    resources: {},
    gmNotes: null,
    sideId: SIDE_ID,
    snapshot: input.snapshot,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/** A Run actor for a Character; its hit points and conditions live on the Character (ADR 0034). */
export function characterActor(input: { id: string; characterId: string }): EncounterRunActorState {
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: 'CHARACTER',
    label: 'Aria',
    sourceId: input.characterId,
    public: true,
    controllerUserIds: [],
    disposition: 'FRIENDLY',
    initiative: null,
    manualOrder: null,
    healthDisplay: null,
    systemId: SRD_SYSTEM_ID,
    stableTieKey: input.id,
    resources: {},
    gmNotes: null,
    sideId: SIDE_ID,
    snapshot: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/** A persisted schema-version-2 active effect carrying only the given state contributions. */
export function activeEffect(input: {
  id: string
  owner: ActiveRuleEffectOwner
  createdOrdinal: number
  version?: number
  stateContributions: [StateContribution, ...StateContribution[]]
}): ActiveRuleEffectRecord {
  const authoredEffectId = '00000000-0000-4000-8000-00000000b004'
  const compiledEntryId = '00000000-0000-4000-8000-00000000b005'
  const definition: ActiveRuleEffectDefinitionDto = {
    schemaVersion: 2,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: ENCOUNTER_ID,
      sourceOccurrenceId: '00000000-0000-4000-8000-00000000b006',
      rootCommandId: '00000000-0000-4000-8000-00000000b007',
      sourceActorId: null
    },
    authoredEffectId,
    compiledEntryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: authoredEffectId,
        gameSystemId: SRD_SYSTEM_ID,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'OWNER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: input.stateContributions
  }
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: null }
  return {
    id: input.id,
    owner: input.owner,
    sourceEncounterId: ENCOUNTER_ID,
    maintainedEffectStateId: null,
    createdOrdinal: input.createdOrdinal,
    version: input.version ?? 1,
    definition,
    definitionChecksum: checksumRuleDocument(definition),
    lifecycle,
    lifecycleChecksum: checksumRuleDocument(lifecycle),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  }
}

/** An SRD Shadow-style Strength Drain contribution (SCALAR_REDUCTION, floor 0, rest recovery). */
export function scalarReduction(valueDefinitionId: string, amount: number): StateContribution {
  return {
    kind: 'SCALAR_REDUCTION',
    valueDefinitionId,
    amount,
    stacking: 'ADDITIVE',
    floor: 0,
    recoveryTriggers: ['SHORT_REST', 'LONG_REST'],
    terminalConsequence: 'TARGET_DIED',
    sourceOutcomeId: '00000000-0000-4000-8000-00000000b008',
    sourceNodeId: 'entry',
    sourceOperationKey: 'comparison'
  }
}
