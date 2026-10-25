import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  initiativeDeclarationModifiersDtoSchema,
  initiativePolicyReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/initiativePolicy'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_SYSTEM_ID } from './vocabulary.js'

const GRAPH_FAMILY = 'rules-runtime-graph' as const
const POLICY_FAMILY = 'initiative-policy' as const

export const SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000004e1'
const SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000eb'
const SRD_DND5E_INITIATIVE_ORDER_CHOICE_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000004e2'
const SRD_DND5E_INITIATIVE_DEXTERITY_TIE_GRAPH_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000004e3'

interface SrdInitiativePolicyDefinitionSeed {
  id: string
  definitionFamilyKey: typeof GRAPH_FAMILY | typeof POLICY_FAMILY
  label: string
  description: string
  document: unknown
  checksum: string
}

function graph(input: Parameters<typeof ruleGraphDefinitionDtoSchema.parse>[0]) {
  return ruleGraphDefinitionDtoSchema.parse(input)
}

function pin(document: { id: string }) {
  return {
    definitionId: document.id,
    definitionVersion: 1,
    definitionChecksum: checksumRuleDocument(document)
  }
}

/**
 * One d20 (two on advantage or disadvantage, keeping the face the roll mode keeps) plus the actor's
 * initiative modifier and the declared-action modifier its policy authored.
 */
export const SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH = graph({
  schemaVersion: 1,
  id: SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: GRAPH_FAMILY,
  nodes: [
    {
      id: 'd20',
      operation: { key: 'evidence.integer-range', contractVersion: 1 },
      inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
    },
    {
      id: 'd20-extra',
      operation: { key: 'evidence.optional-integer-range', contractVersion: 1 },
      inputs: {
        min: { kind: 'LITERAL', value: 1 },
        max: { kind: 'LITERAL', value: 20 },
        enabled: { kind: 'FACT', factKey: 'initiative.extra-d20' }
      }
    },
    {
      id: 'd20-kept',
      operation: { key: 'number.keep-one-of-two', contractVersion: 1 },
      inputs: {
        first: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
        second: { kind: 'NODE_OUTPUT', nodeId: 'd20-extra', port: 'value' },
        keep: { kind: 'FACT', factKey: 'initiative.keep' }
      }
    },
    {
      id: 'declared-modifier',
      operation: { key: 'number.add', contractVersion: 1 },
      inputs: {
        left: { kind: 'FACT', factKey: 'initiative.modifier' },
        right: { kind: 'FACT', factKey: 'initiative.speed-factor.modifier' }
      }
    },
    {
      id: 'score',
      operation: { key: 'number.add', contractVersion: 1 },
      inputs: {
        left: { kind: 'NODE_OUTPUT', nodeId: 'd20-kept', port: 'value' },
        right: { kind: 'NODE_OUTPUT', nodeId: 'declared-modifier', port: 'value' }
      }
    }
  ],
  outputs: {
    automatic: { kind: 'LITERAL', value: true },
    score: { kind: 'NODE_OUTPUT', nodeId: 'score', port: 'value' }
  }
})

/** The table picks which tied actor goes first, as an index in the System's bounds. */
const orderChoiceGraph = graph({
  schemaVersion: 1,
  id: SRD_DND5E_INITIATIVE_ORDER_CHOICE_GRAPH_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: GRAPH_FAMILY,
  nodes: [
    {
      id: 'order',
      operation: { key: 'evidence.integer-range', contractVersion: 1 },
      inputs: {
        min: { kind: 'FACT', factKey: 'initiative.choice-min-index' },
        max: { kind: 'FACT', factKey: 'initiative.choice-max-index' }
      }
    }
  ],
  outputs: { selection: { kind: 'NODE_OUTPUT', nodeId: 'order', port: 'value' } }
})

/** The higher Dexterity score goes first; an equal score is left to the table's order choice. */
const dexterityTieGraph = graph({
  schemaVersion: 1,
  id: SRD_DND5E_INITIATIVE_DEXTERITY_TIE_GRAPH_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: GRAPH_FAMILY,
  nodes: [
    {
      id: 'score',
      operation: { key: 'number.add', contractVersion: 1 },
      inputs: {
        left: { kind: 'FACT', factKey: 'initiative.dexterity-score' },
        right: { kind: 'LITERAL', value: 0 }
      }
    }
  ],
  outputs: {
    automatic: { kind: 'LITERAL', value: true },
    score: { kind: 'NODE_OUTPUT', nodeId: 'score', port: 'value' }
  }
})

const scorePin = { scoreOutput: 'score', sortDirection: 'DESCENDING', automaticOutput: 'automatic' }

/** The DMG Speed Factor table: size, weapon and spell-level modifiers to a declared initiative. */
export const SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS =
  initiativeDeclarationModifiersDtoSchema.parse({
    sizes: [
      { size: 'TINY', modifier: 5 },
      { size: 'SMALL', modifier: 2 },
      { size: 'MEDIUM', modifier: 0 },
      { size: 'LARGE', modifier: -2 },
      { size: 'HUGE', modifier: -5 },
      { size: 'GARGANTUAN', modifier: -8 }
    ],
    factors: [
      {
        id: '00000000-0000-4000-8000-0000000004e4',
        label: 'Melee, heavy weapon',
        equipmentPropertySets: [['MELEE', 'HEAVY']],
        modifier: -2
      },
      {
        id: '00000000-0000-4000-8000-0000000004e5',
        label: 'Melee, light or finesse weapon',
        equipmentPropertySets: [
          ['MELEE', 'LIGHT'],
          ['MELEE', 'FINESSE']
        ],
        modifier: 2
      },
      {
        id: '00000000-0000-4000-8000-0000000004e6',
        label: 'Melee, two-handed weapon',
        equipmentPropertySets: [['MELEE', 'TWO_HANDED']],
        modifier: -2
      },
      {
        id: '00000000-0000-4000-8000-0000000004e7',
        label: 'Ranged, loading weapon',
        equipmentPropertySets: [['RANGED', 'LOADING']],
        modifier: -5
      }
    ],
    spellLevel: { modifierPerLevel: -1 }
  })

/** The DMG Speed Factor variant: actors declare their action each round, then roll. */
const speedFactorPolicy = initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'INITIATIVE_POLICY',
  id: SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  procedure: 'DECLARED_ACTION_ROLL',
  cadence: 'EACH_ROUND',
  evaluationGraph: { ...pin(SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH), ...scorePin },
  orderChoiceGraph: {
    ...pin(orderChoiceGraph),
    selectionOutput: 'selection',
    minimumIndexFact: 'initiative.choice-min-index',
    maximumIndexFact: 'initiative.choice-max-index'
  },
  tieResolvers: [
    { ...pin(dexterityTieGraph), ...scorePin, repeatOnTie: false, maximumAttempts: 1 }
  ],
  defaultTieResolverDefinitionId: dexterityTieGraph.id,
  declarationModifiers: SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS
})

function define(input: Omit<SrdInitiativePolicyDefinitionSeed, 'checksum'>) {
  return { ...input, checksum: checksumRuleDocument(input.document) }
}

/** The Campaign-selectable initiative variants and the graphs they pin. */
export const SRD_INITIATIVE_POLICY_DEFINITIONS: readonly SrdInitiativePolicyDefinitionSeed[] = [
  define({
    id: SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Speed Factor initiative graph',
    description: 'D&D declared-action initiative roll.',
    document: SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH
  }),
  define({
    id: orderChoiceGraph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Initiative order choice graph',
    description: 'D&D table choice among tied initiative actors.',
    document: orderChoiceGraph
  }),
  define({
    id: dexterityTieGraph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Higher Dexterity score',
    description: 'D&D initiative tie resolved by the higher Dexterity score.',
    document: dexterityTieGraph
  }),
  define({
    id: speedFactorPolicy.id,
    definitionFamilyKey: POLICY_FAMILY,
    label: 'Speed Factor',
    description: 'DMG variant: declare an action each round, then roll initiative modified by it.',
    document: speedFactorPolicy
  })
]
