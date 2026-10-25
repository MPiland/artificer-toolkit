import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  initiativePolicyReusableDefinitionDocumentDtoSchema,
  type InitiativePolicyReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/initiativePolicy'
import {
  encounterInitiativePolicySnapshotDtoSchema,
  type EncounterInitiativePolicySnapshotDto
} from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_INITIATIVE_POLICY_DEFINITIONS } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'

import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { DND5E_INITIATIVE_FACT_KEYS } from '../systems/dnd5e/initiativeFactAdapter.js'

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

/**
 * The frozen snapshot of the seeded SRD initiative policy `policyDefinitionId` and the graphs it pins,
 * built from the seed documents Campaigns select it from.
 */
export function seededInitiativePolicySnapshot(policyDefinitionId: string): {
  snapshot: EncounterInitiativePolicySnapshotDto
  checksum: string
} {
  const seeded = (id: string) => {
    const definition = SRD_INITIATIVE_POLICY_DEFINITIONS.find((candidate) => candidate.id === id)
    if (!definition) throw new Error(`The SRD seeds no initiative definition ${id}.`)
    return pinnedDefinition(definition.id, definition.label, definition.document)
  }
  const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.parse(
    seeded(policyDefinitionId).document
  )
  const snapshot = encounterInitiativePolicySnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: policy.gameSystemId,
    policy: seeded(policy.id),
    evaluationGraph: seeded(policy.evaluationGraph.definitionId),
    orderChoiceGraph: seeded(policy.orderChoiceGraph.definitionId),
    tieResolver: seeded(policy.defaultTieResolverDefinitionId)
  })
  return { snapshot, checksum: checksumCanonicalJson(snapshot) }
}
