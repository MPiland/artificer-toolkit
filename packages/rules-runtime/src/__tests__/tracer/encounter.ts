import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CurrentReusableDefinitionSource } from '../../ruleCapabilityStateService.js'
import { pinnedInitiativePolicySnapshot } from '../../testing/initiativePolicySnapshot.js'
import { activeEffect } from '../encounterActiveEffectFixtures.js'
import { TRACER_INITIATIVE_FACT_KEYS } from './encounterTier.js'
import { add, fateDie, fourFateDice, nodeOutput, tracerGraph } from './graph.js'
import {
  TRACER_ACTOR_ACTION_CAPABILITY_ID,
  TRACER_APPROACH_DEFINITION_IDS,
  TRACER_EXCHANGE_ACTION_ALLOWANCE_ID,
  TRACER_SYSTEM_ID,
  type TracerApproach
} from './system.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-0000000fe001'
const TIMESTAMP = '2026-10-25T00:00:00.000Z'
const PUBLISHER_ID = '00000000-0000-4000-8000-0000000fe002'
const CONTENT_SOURCE_ID = '00000000-0000-4000-8000-0000000fe003'
const THUG_BLUEPRINT_ID = '00000000-0000-4000-8000-0000000fe007'

/** A Creature Blueprint rated in every approach, Quick rolling its initiative. */
export function tracerCreatureActor(input: {
  id: string
  sideId: string
  ratings: Readonly<Record<TracerApproach, number>>
  ruleUsage?: Readonly<Record<string, number>>
  defeated?: boolean
}): EncounterRunActorState {
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: 'Thug',
    sourceId: THUG_BLUEPRINT_ID,
    sourceRevision: 1,
    public: true,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    initiative: null,
    manualOrder: null,
    form: null,
    absence: null,
    healthDisplay: null,
    systemId: TRACER_SYSTEM_ID,
    stableTieKey: input.id,
    currentHitPoints: 3,
    maxHitPoints: 3,
    tempHitPoints: 0,
    conditions: [],
    defeated: input.defeated ?? false,
    resources: input.ruleUsage ? { ruleUsage: { ...input.ruleUsage } } : {},
    gmNotes: null,
    sideId: input.sideId,
    snapshot: {
      kind: 'CREATURE',
      id: THUG_BLUEPRINT_ID,
      systemId: TRACER_SYSTEM_ID,
      sourceRevision: 1,
      payload: {
        size: 'PERSONAL',
        damageVulnerabilities: [],
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
        qualifiedDamageDefenses: []
      },
      ruleFacts: {
        gameSystemId: TRACER_SYSTEM_ID,
        vocabularySnapshotId: '00000000-0000-4000-8000-0000000fe004',
        vocabularySnapshotVersion: 1,
        vocabularySnapshotChecksum: 'c'.repeat(64),
        abilityScores: Object.fromEntries(
          Object.entries(input.ratings).map(([approach, rating]) => [
            TRACER_APPROACH_DEFINITION_IDS[approach as TracerApproach],
            rating
          ])
        ),
        saveProficiencyBonuses: {},
        resourceAbilityScores: {},
        initiativeAbilityDefinitionId: TRACER_APPROACH_DEFINITION_IDS.QUICK,
        modifiers: []
      }
    },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/** A modifier-free effect a tracer actor holds, whose lifecycle codes the tracer vocabulary reads. */
export function tracerActiveEffect(input: {
  id: string
  holderActorId: string
  consumeOnFirstEvents?: readonly string[]
  endOnEvents?: readonly string[]
}): ActiveRuleEffectRecord {
  const effect = activeEffect({
    id: input.id,
    owner: {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: ENCOUNTER_ID,
      targetActorId: input.holderActorId
    },
    createdOrdinal: 1,
    ...(input.consumeOnFirstEvents && { consumeOnFirstEvents: input.consumeOnFirstEvents }),
    ...(input.endOnEvents && { endOnEvents: input.endOnEvents }),
    stateContributions: [
      {
        kind: 'MODIFIER_GRANT',
        applyGrantOutcomeId: input.id,
        modifiers: [],
        senses: [],
        sourceLabel: 'Aspect',
        sourceHidden: false
      }
    ]
  })
  const { frozenGraph } = effect.definition
  return {
    ...effect,
    definition: {
      ...effect.definition,
      frozenGraph: {
        ...frozenGraph,
        source: { ...frozenGraph.source, gameSystemId: TRACER_SYSTEM_ID }
      }
    }
  }
}

/** A tracer Encounter Run with no optional combat rules; active in exchange 1 unless told otherwise. */
export function tracerEncounterState(input: {
  actors: readonly EncounterRunActorState[]
  sides: readonly { id: string; label: string }[]
  status?: EncounterRunState['status']
  initiativePolicy?: { snapshot: EncounterInitiativePolicySnapshotDto; checksum: string }
}): EncounterRunState {
  const optionalCombatSnapshot = {
    schemaVersion: 1,
    gameSystemId: TRACER_SYSTEM_ID,
    definitions: []
  }
  return encounterRunStateSchema.parse({
    id: ENCOUNTER_ID,
    campaignId: '00000000-0000-4000-8000-0000000fe005',
    gameSystemId: TRACER_SYSTEM_ID,
    blueprintId: '00000000-0000-4000-8000-0000000fe006',
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    name: 'Tracer conflict',
    status: input.status ?? 'ACTIVE',
    automationMode: 'ASSISTED',
    trackAmmunition: false,
    zoneNoticing: 'GM_PROMPT',
    automaticCover: true,
    healthDisplayDefault: 'HIDDEN',
    version: 0,
    round: input.status === 'PREPARED' ? 0 : 1,
    currentActorId: null,
    actorIds: input.actors.map((actor) => actor.id),
    initiativePolicySnapshot: input.initiativePolicy?.snapshot ?? null,
    initiativePolicySnapshotChecksum: input.initiativePolicy?.checksum ?? null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumRuleDocument(optionalCombatSnapshot),
    turnSequence: 0,
    sides: input.sides.map((side, sortOrder) => ({ ...side, sortOrder })),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/** Four Fate dice plus the initiative approach rating, highest first; one Fate die breaks ties. */
export function tracerInitiativePolicy(input: { cadence: 'ENCOUNTER_START' | 'EACH_ROUND' }) {
  return pinnedInitiativePolicySnapshot({
    gameSystemId: TRACER_SYSTEM_ID,
    procedure: 'ACTOR_ROLL',
    cadence: input.cadence,
    evaluation: {
      label: '4dF + approach',
      graph: tracerGraph(
        '00000000-0000-4000-8000-0000000fd001',
        [
          ...fourFateDice,
          add('score', nodeOutput('dice'), {
            kind: 'FACT',
            factKey: TRACER_INITIATIVE_FACT_KEYS.rating
          })
        ],
        { score: nodeOutput('score'), automatic: { kind: 'LITERAL', value: true } }
      )
    },
    tieResolver: {
      label: '1dF tie-breaker',
      graph: tracerGraph('00000000-0000-4000-8000-0000000fd002', [fateDie('f1')], {
        score: nodeOutput('f1'),
        automatic: { kind: 'LITERAL', value: true }
      })
    },
    orderChoice: {
      label: 'Order choice',
      minimumIndexFact: TRACER_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
      maximumIndexFact: TRACER_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex,
      graph: tracerGraph(
        '00000000-0000-4000-8000-0000000fd003',
        [
          {
            id: 'order',
            operation: { key: 'evidence.integer-range', contractVersion: 1 },
            inputs: {
              min: { kind: 'FACT', factKey: TRACER_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex },
              max: { kind: 'FACT', factKey: TRACER_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex }
            }
          }
        ],
        { selection: nodeOutput('order') }
      )
    }
  })
}

function ruleCapability(
  id: string,
  usage: { maximum: number; refreshBoundary: 'START_OF_TURN' } | null
) {
  return { schemaVersion: 1, kind: 'RULE_CAPABILITY', id, gameSystemId: TRACER_SYSTEM_ID, usage }
}

const tracerCapabilities = new Map([
  [
    TRACER_EXCHANGE_ACTION_ALLOWANCE_ID,
    {
      label: 'Exchange action',
      document: ruleCapability(TRACER_EXCHANGE_ACTION_ALLOWANCE_ID, {
        maximum: 1,
        refreshBoundary: 'START_OF_TURN'
      })
    }
  ],
  [
    TRACER_ACTOR_ACTION_CAPABILITY_ID,
    { label: 'Act', document: ruleCapability(TRACER_ACTOR_ACTION_CAPABILITY_ID, null) }
  ]
])

/** The tracer's published definitions: its exchange-action allowance and its actor-action capability. */
export const tracerDefinitions: CurrentReusableDefinitionSource = {
  async requireCurrent(definitionId) {
    const capability = tracerCapabilities.get(definitionId)
    if (!capability) throw new Error(`Tracer definition "${definitionId}" is missing.`)
    return reusableDefinitionCurrentDtoSchema.parse({
      id: definitionId,
      gameSystemId: TRACER_SYSTEM_ID,
      contentSourceId: CONTENT_SOURCE_ID,
      definitionFamilyKey: 'rule-capability',
      label: capability.label,
      description: null,
      document: capability.document,
      checksum: checksumRuleDocument(capability.document),
      contractVersion: 1,
      version: 1,
      publishedAt: TIMESTAMP,
      publishedBy: PUBLISHER_ID
    })
  }
}
