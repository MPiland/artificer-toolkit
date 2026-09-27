import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import {
  initiativePolicyReusableDefinitionDocumentDtoSchema,
  type InitiativePolicyReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/initiativePolicy'
import {
  encounterInitiativePolicySnapshotDtoSchema,
  type EncounterInitiativePolicySnapshotDto
} from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  createStagedInitiativeRoundState,
  hydrateStagedState
} from '../encounterInitiativeStaging.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { DND5E_INITIATIVE_FACT_KEYS } from '../systems/dnd5e/initiativeFactAdapter.js'
import { ENCOUNTER_ID } from './dnd5eSrdEncounter.js'

/** Canonical ascending actor identities; A < B < C. */
export const ACTOR_A = '00000000-0000-4000-8000-0000000000a1'
export const ACTOR_B = '00000000-0000-4000-8000-0000000000a2'
export const ACTOR_C = '00000000-0000-4000-8000-0000000000a3'
export const SIDE_HEROES = '00000000-0000-4000-8000-0000000005a1'
export const SIDE_FOES = '00000000-0000-4000-8000-0000000005a2'

const CONTENT_SOURCE_ID = '00000000-0000-4000-8000-00000000c001'
const EVALUATION_GRAPH_ID = '00000000-0000-4000-8000-00000000d001'
const TIE_GRAPH_ID = '00000000-0000-4000-8000-00000000d002'
const ORDER_CHOICE_GRAPH_ID = '00000000-0000-4000-8000-00000000d003'
const POLICY_ID = '00000000-0000-4000-8000-00000000d004'

type Procedure = InitiativePolicyReusableDefinitionDocumentDto['procedure']
type Cadence = InitiativePolicyReusableDefinitionDocumentDto['cadence']

/** d20 + the System initiative modifier; the policy evaluation graph. */
const evaluationGraph = ruleGraphDefinitionDtoSchema.parse({
  schemaVersion: 1,
  id: EVALUATION_GRAPH_ID,
  gameSystemId: DND5E_SYSTEM_ID,
  definitionFamilyKey: 'rules-runtime-graph',
  nodes: [
    {
      id: 'd20',
      operation: { key: 'evidence.integer-range', contractVersion: 1 },
      inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
    },
    {
      id: 'score',
      operation: { key: 'number.add', contractVersion: 1 },
      inputs: {
        left: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
        right: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.modifier }
      }
    }
  ],
  outputs: {
    score: { kind: 'NODE_OUTPUT', nodeId: 'score', port: 'value' },
    automatic: { kind: 'LITERAL', value: true }
  }
})

/** The SRD's optional tie-breaker: a bare d20, highest first. */
const tieGraph = ruleGraphDefinitionDtoSchema.parse({
  schemaVersion: 1,
  id: TIE_GRAPH_ID,
  gameSystemId: DND5E_SYSTEM_ID,
  definitionFamilyKey: 'rules-runtime-graph',
  nodes: [
    {
      id: 'd20',
      operation: { key: 'evidence.integer-range', contractVersion: 1 },
      inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
    }
  ],
  outputs: {
    score: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
    automatic: { kind: 'LITERAL', value: true }
  }
})

const orderChoiceGraph = ruleGraphDefinitionDtoSchema.parse({
  schemaVersion: 1,
  id: ORDER_CHOICE_GRAPH_ID,
  gameSystemId: DND5E_SYSTEM_ID,
  definitionFamilyKey: 'rules-runtime-graph',
  nodes: [
    {
      id: 'order',
      operation: { key: 'evidence.integer-range', contractVersion: 1 },
      inputs: {
        min: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex },
        max: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex }
      }
    }
  ],
  outputs: { selection: { kind: 'NODE_OUTPUT', nodeId: 'order', port: 'value' } }
})

function graphPin(graph: typeof evaluationGraph) {
  return {
    definitionId: graph.id,
    definitionVersion: 1,
    definitionChecksum: checksumRuleDocument(graph),
    scoreOutput: 'score',
    sortDirection: 'DESCENDING' as const,
    automaticOutput: 'automatic'
  }
}

function pinnedDefinition<TDocument>(id: string, label: string, document: TDocument) {
  return {
    definitionId: id,
    contentSourceId: CONTENT_SOURCE_ID,
    definitionVersion: 1,
    definitionChecksum: checksumRuleDocument(document),
    contractVersion: 1,
    label,
    document
  }
}

/** A frozen Encounter initiative policy snapshot and its checksum, as Encounter admission pins it. */
export function initiativePolicySnapshot(input: {
  procedure: Procedure
  cadence: Cadence
  tie?: { repeatOnTie: boolean; maximumAttempts: number }
}): { snapshot: EncounterInitiativePolicySnapshotDto; checksum: string } {
  const tie = input.tie ?? { repeatOnTie: false, maximumAttempts: 1 }
  const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'INITIATIVE_POLICY',
    id: POLICY_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    procedure: input.procedure,
    cadence: input.cadence,
    evaluationGraph: graphPin(evaluationGraph),
    orderChoiceGraph: {
      definitionId: orderChoiceGraph.id,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument(orderChoiceGraph),
      selectionOutput: 'selection',
      minimumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
      maximumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex
    },
    tieResolvers: [{ ...graphPin(tieGraph), ...tie }],
    defaultTieResolverDefinitionId: tieGraph.id
  })
  const snapshot = encounterInitiativePolicySnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    policy: pinnedDefinition(POLICY_ID, 'Test initiative policy', policy),
    evaluationGraph: pinnedDefinition(evaluationGraph.id, 'd20 + modifier', evaluationGraph),
    orderChoiceGraph: pinnedDefinition(orderChoiceGraph.id, 'Order choice', orderChoiceGraph),
    tieResolver: pinnedDefinition(tieGraph.id, 'd20 tie-breaker', tieGraph)
  })
  return { snapshot, checksum: checksumCanonicalJson(snapshot) }
}

/** The staged PREPARING round Encounter start or a new round creates for these actors. */
export function preparingRound(input: {
  actors: readonly { id: string; sideId: string }[]
  round?: number
  policy?: { snapshot: EncounterInitiativePolicySnapshotDto; checksum: string }
}): EncounterInitiativeRoundStateDto {
  return hydrateStagedState(
    createStagedInitiativeRoundState({
      encounter: {
        id: ENCOUNTER_ID,
        automationMode: input.policy ? 'ASSISTED' : 'MANUAL',
        initiativePolicySnapshot: input.policy?.snapshot ?? null,
        initiativePolicySnapshotChecksum: input.policy?.checksum ?? null,
        actors: input.actors
      },
      round: input.round ?? 1
    })
  )
}

/** A Creature initiative source; the D&D adapter reads only its initiative modifier. */
export function creatureSource(
  actorId: string,
  initiativeModifier: number
): InitiativeActorFactSource {
  return {
    kind: 'CREATURE',
    actor: { id: actorId, sourceId: null, snapshot: null, sourceRevision: null },
    systemId: DND5E_SYSTEM_ID,
    actorRule: {
      actorId,
      initiativeModifier,
      targetProtection: { status: 'NOT_NORMALIZED' },
      featureResources: []
    }
  }
}

export function customSource(actorId: string): InitiativeActorFactSource {
  return {
    kind: 'CUSTOM',
    actor: { id: actorId, sourceId: null, snapshot: null, sourceRevision: null },
    systemId: null
  }
}

/** Scripted trusted dice: returns each queued value once, in order, and records each request. */
export function scriptedDice(values: readonly number[]) {
  const queue = [...values]
  const requests: { min: number; max: number }[] = []
  return {
    requests,
    remaining: () => queue.length,
    next(request: { min: number; max: number }): number {
      requests.push({ min: request.min, max: request.max })
      const value = queue.shift()
      if (value === undefined) throw new Error('The scripted dice ran out.')
      return value
    }
  }
}
