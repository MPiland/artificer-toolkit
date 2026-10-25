import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CurrentReusableDefinitionSource } from '../../ruleCapabilityStateService.js'
import { pinnedInitiativePolicySnapshot } from '../../testing/initiativePolicySnapshot.js'
import { TRACER_INITIATIVE_FACT_KEYS } from './encounterTier.js'
import {
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
    defeated: false,
    resources: input.ruleUsage ? { ruleUsage: { ...input.ruleUsage } } : {},
    gmNotes: null,
    sideId: input.sideId,
    snapshot: {
      kind: 'CREATURE',
      id: THUG_BLUEPRINT_ID,
      systemId: TRACER_SYSTEM_ID,
      sourceRevision: 1,
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

function tracerGraph(id: string, nodes: unknown[], outputs: Record<string, unknown>) {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id,
    gameSystemId: TRACER_SYSTEM_ID,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes,
    outputs
  })
}

const fateDie = (id: string) => ({
  id,
  operation: { key: 'evidence.integer-range', contractVersion: 1 },
  inputs: { min: { kind: 'LITERAL', value: -1 }, max: { kind: 'LITERAL', value: 1 } }
})

const add = (id: string, left: unknown, right: unknown) => ({
  id,
  operation: { key: 'number.add', contractVersion: 1 },
  inputs: { left, right }
})

const nodeOutput = (nodeId: string) => ({ kind: 'NODE_OUTPUT', nodeId, port: 'value' })

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
          fateDie('f1'),
          fateDie('f2'),
          fateDie('f3'),
          fateDie('f4'),
          add('f12', nodeOutput('f1'), nodeOutput('f2')),
          add('f34', nodeOutput('f3'), nodeOutput('f4')),
          add('dice', nodeOutput('f12'), nodeOutput('f34')),
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

const exchangeActionAllowance = {
  schemaVersion: 1,
  kind: 'RULE_CAPABILITY',
  id: TRACER_EXCHANGE_ACTION_ALLOWANCE_ID,
  gameSystemId: TRACER_SYSTEM_ID,
  usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
}

/** The tracer's published definitions: its exchange-action allowance. */
export const tracerDefinitions: CurrentReusableDefinitionSource = {
  async requireCurrent(definitionId) {
    if (definitionId !== TRACER_EXCHANGE_ACTION_ALLOWANCE_ID)
      throw new Error(`Tracer definition "${definitionId}" is missing.`)
    return reusableDefinitionCurrentDtoSchema.parse({
      id: definitionId,
      gameSystemId: TRACER_SYSTEM_ID,
      contentSourceId: CONTENT_SOURCE_ID,
      definitionFamilyKey: 'rule-capability',
      label: 'Exchange action',
      description: null,
      document: exchangeActionAllowance,
      checksum: checksumRuleDocument(exchangeActionAllowance),
      contractVersion: 1,
      version: 1,
      publishedAt: TIMESTAMP,
      publishedBy: PUBLISHER_ID
    })
  }
}
