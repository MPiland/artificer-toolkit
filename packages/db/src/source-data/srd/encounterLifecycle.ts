import {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_SYSTEM_ID } from './vocabulary.js'

const FAMILY = 'dnd5e-encounter-lifecycle' as const
const GRAPH_FAMILY = 'rules-runtime-graph' as const

export const SRD_DND5E_LEGENDARY_ACTION_ELIGIBILITY_GRAPH_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000e1'
export const SRD_DND5E_LEGENDARY_RESISTANCE_CHOICE_GRAPH_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000e3'
export const SRD_DND5E_RECHARGE_4_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e5'
export const SRD_DND5E_RECHARGE_5_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e7'
export const SRD_DND5E_RECHARGE_6_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e9'

export interface SrdEncounterLifecycleDefinitionSeed {
  id: string
  definitionFamilyKey: typeof FAMILY | typeof GRAPH_FAMILY
  label: string
  description: string
  document: unknown
  checksum: string
}

function define(input: Omit<SrdEncounterLifecycleDefinitionSeed, 'checksum'>) {
  return { ...input, checksum: checksumRuleDocument(input.document) }
}

function graph(input: Parameters<typeof ruleGraphDefinitionDtoSchema.parse>[0]) {
  return ruleGraphDefinitionDtoSchema.parse(input)
}

const legendaryEligibilityGraph = graph({
  schemaVersion: 1,
  id: SRD_DND5E_LEGENDARY_ACTION_ELIGIBILITY_GRAPH_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: GRAPH_FAMILY,
  nodes: [
    {
      id: 'eligibility',
      operation: { key: 'dnd5e.legendary-action-eligibility', contractVersion: 1 },
      inputs: {
        outgoingActorDiffers: { kind: 'FACT', factKey: 'dnd5e.legendary.outgoing-actor-differs' },
        ownerCanAct: { kind: 'FACT', factKey: 'dnd5e.legendary.owner-can-act' },
        remainingPool: { kind: 'FACT', factKey: 'dnd5e.legendary.remaining-pool' },
        windowUsed: { kind: 'FACT', factKey: 'dnd5e.legendary.window-used' }
      }
    }
  ],
  outputs: { eligible: { kind: 'NODE_OUTPUT', nodeId: 'eligibility', port: 'eligible' } }
})

const legendaryResistanceChoiceGraph = graph({
  schemaVersion: 1,
  id: SRD_DND5E_LEGENDARY_RESISTANCE_CHOICE_GRAPH_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: GRAPH_FAMILY,
  nodes: [
    {
      id: 'choice',
      operation: { key: 'evidence.bounded-choice-index', contractVersion: 1 },
      inputs: { minIndex: { kind: 'LITERAL', value: 0 }, maxIndex: { kind: 'LITERAL', value: 1 } }
    },
    {
      id: 'use',
      operation: { key: 'number.compare-threshold', contractVersion: 1 },
      inputs: {
        value: { kind: 'NODE_OUTPUT', nodeId: 'choice', port: 'selectedIndex' },
        threshold: { kind: 'LITERAL', value: 1 }
      }
    }
  ],
  outputs: { use: { kind: 'NODE_OUTPUT', nodeId: 'use', port: 'passed' } }
})

function rechargeGraph(threshold: 4 | 5 | 6, id: string) {
  return graph({
    schemaVersion: 1,
    id,
    gameSystemId: SRD_SYSTEM_ID,
    definitionFamilyKey: GRAPH_FAMILY,
    nodes: [
      {
        id: 'd6',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 6 } }
      },
      {
        id: 'recharge',
        operation: { key: 'number.compare-threshold', contractVersion: 1 },
        inputs: {
          value: { kind: 'NODE_OUTPUT', nodeId: 'd6', port: 'value' },
          threshold: { kind: 'LITERAL', value: threshold }
        }
      }
    ],
    outputs: { recharged: { kind: 'NODE_OUTPUT', nodeId: 'recharge', port: 'passed' } }
  })
}

const recharge4Graph = rechargeGraph(4, SRD_DND5E_RECHARGE_4_GRAPH_DEFINITION_ID)
const recharge5Graph = rechargeGraph(5, SRD_DND5E_RECHARGE_5_GRAPH_DEFINITION_ID)
const recharge6Graph = rechargeGraph(6, SRD_DND5E_RECHARGE_6_GRAPH_DEFINITION_ID)

function pin(document: { id: string; checksum: string }) {
  return { definitionId: document.id, definitionVersion: 1, definitionChecksum: document.checksum }
}

const legendaryActionLifecycle = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'LEGENDARY_ACTION',
  id: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  eligibilityGraph: {
    ...pin({
      id: legendaryEligibilityGraph.id,
      checksum: checksumRuleDocument(legendaryEligibilityGraph)
    }),
    eligibleOutput: 'eligible'
  },
  windowStage: 'END_OF_OTHER_ACTOR_TURN',
  refreshStage: 'START_OF_TURN',
  resourceRecovery: 'FULL',
  maximumActionsPerWindow: 1
})

const legendaryResistanceLifecycle =
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'LEGENDARY_RESISTANCE',
    id: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
    gameSystemId: SRD_SYSTEM_ID,
    choiceGraph: {
      ...pin({
        id: legendaryResistanceChoiceGraph.id,
        checksum: checksumRuleDocument(legendaryResistanceChoiceGraph)
      }),
      useOutput: 'use'
    },
    interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
    replacement: 'SAVE_SUCCESS'
  })

function rechargeLifecycle(input: { id: string; graph: typeof recharge4Graph }) {
  return dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'RECHARGE',
    id: input.id,
    gameSystemId: SRD_SYSTEM_ID,
    rechargeGraph: {
      ...pin({ id: input.graph.id, checksum: checksumRuleDocument(input.graph) }),
      rechargedOutput: 'recharged'
    },
    boundary: 'START_OF_TURN',
    recovery: 'FULL'
  })
}

const recharge4Lifecycle = rechargeLifecycle({
  id: DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  graph: recharge4Graph
})
const recharge5Lifecycle = rechargeLifecycle({
  id: DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  graph: recharge5Graph
})
const recharge6Lifecycle = rechargeLifecycle({
  id: DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
  graph: recharge6Graph
})

/** Exact immutable documents consumed by Creature Feature lifecycle bindings. */
export const SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS: readonly SrdEncounterLifecycleDefinitionSeed[] = [
  define({
    id: legendaryEligibilityGraph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Legendary action eligibility graph',
    description: 'D&D legendary action eligibility graph.',
    document: legendaryEligibilityGraph
  }),
  define({
    id: legendaryActionLifecycle.id,
    definitionFamilyKey: FAMILY,
    label: 'Legendary action lifecycle',
    description: 'D&D legendary action refresh and opportunity lifecycle.',
    document: legendaryActionLifecycle
  }),
  define({
    id: legendaryResistanceChoiceGraph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Legendary resistance choice graph',
    description: 'D&D legendary resistance choice graph.',
    document: legendaryResistanceChoiceGraph
  }),
  define({
    id: legendaryResistanceLifecycle.id,
    definitionFamilyKey: FAMILY,
    label: 'Legendary resistance lifecycle',
    description: 'D&D legendary resistance lifecycle.',
    document: legendaryResistanceLifecycle
  }),
  define({
    id: recharge4Graph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Recharge 4–6 graph',
    description: 'D&D d6 recharge graph with a 4 threshold.',
    document: recharge4Graph
  }),
  define({
    id: recharge4Lifecycle.id,
    definitionFamilyKey: FAMILY,
    label: 'Recharge 4–6 lifecycle',
    description: 'D&D 4–6 recharge lifecycle.',
    document: recharge4Lifecycle
  }),
  define({
    id: recharge5Graph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Recharge 5–6 graph',
    description: 'D&D d6 recharge graph with a 5 threshold.',
    document: recharge5Graph
  }),
  define({
    id: recharge5Lifecycle.id,
    definitionFamilyKey: FAMILY,
    label: 'Recharge 5–6 lifecycle',
    description: 'D&D 5–6 recharge lifecycle.',
    document: recharge5Lifecycle
  }),
  define({
    id: recharge6Graph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Recharge 6 graph',
    description: 'D&D d6 recharge graph with a 6 threshold.',
    document: recharge6Graph
  }),
  define({
    id: recharge6Lifecycle.id,
    definitionFamilyKey: FAMILY,
    label: 'Recharge 6 lifecycle',
    description: 'D&D 6 recharge lifecycle.',
    document: recharge6Lifecycle
  })
]
