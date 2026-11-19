import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_SYSTEM_ID } from './vocabulary.js'

const GRAPH_FAMILY = 'rules-runtime-graph' as const

const SRD_DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_GRAPH_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000d1'
const SRD_DND5E_MOVEMENT_REACTION_CHOICE_GRAPH_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000d3'

function fact(factKey: string) {
  return { kind: 'FACT' as const, factKey }
}

/** Whether a creature leaving reach may be answered by a reaction, and which allowance it spends. */
const opportunityEligibilityGraph = ruleGraphDefinitionDtoSchema.parse({
  schemaVersion: 1,
  id: SRD_DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_GRAPH_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: GRAPH_FAMILY,
  nodes: [
    {
      id: 'eligibility',
      operation: { key: 'dnd5e.movement-reaction-eligibility', contractVersion: 1 },
      inputs: {
        actualStage: fact('dnd5e.reaction-stage'),
        expectedStage: { kind: 'LITERAL', value: 'BEFORE_LEAVE_REACH' },
        movementKind: fact('dnd5e.reaction-movement-kind'),
        contactValid: fact('dnd5e.reaction-contact-valid'),
        perceptionSatisfied: fact('dnd5e.reaction-perception-satisfied'),
        reactorCanAct: fact('dnd5e.reaction-reactor-can-act'),
        targetHostile: fact('dnd5e.reaction-target-hostile'),
        allowanceAvailable: fact('dnd5e.reaction-allowance-available'),
        freeReactionGranted: fact('dnd5e.reaction-free-granted'),
        freeAllowanceAvailable: fact('dnd5e.reaction-free-allowance-available'),
        suppressed: fact('dnd5e.reaction-suppressed')
      }
    }
  ],
  outputs: {
    eligible: { kind: 'NODE_OUTPUT', nodeId: 'eligibility', port: 'eligible' },
    freeReaction: { kind: 'NODE_OUTPUT', nodeId: 'eligibility', port: 'freeReaction' },
    selectionPolicy: { kind: 'LITERAL', value: 'CHOICE' },
    choiceDefinitionId: {
      kind: 'LITERAL',
      value: SRD_DND5E_MOVEMENT_REACTION_CHOICE_GRAPH_DEFINITION_ID
    },
    targetPolicy: { kind: 'LITERAL', value: 'MOVER' }
  }
})

/** The reactor's pick among its eligible movement reactions; index zero declines. */
const movementReactionChoiceGraph = ruleGraphDefinitionDtoSchema.parse({
  schemaVersion: 1,
  id: SRD_DND5E_MOVEMENT_REACTION_CHOICE_GRAPH_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID,
  definitionFamilyKey: GRAPH_FAMILY,
  nodes: [
    {
      id: 'choice',
      operation: { key: 'evidence.bounded-choice-index', contractVersion: 1 },
      inputs: { minIndex: fact('choice-min-index'), maxIndex: fact('choice-max-index') }
    }
  ],
  outputs: { selectedIndex: { kind: 'NODE_OUTPUT', nodeId: 'choice', port: 'selectedIndex' } }
})

/** The published graphs a movement reaction binding names. */
export const SRD_MOVEMENT_REACTION_DEFINITIONS = [
  {
    id: opportunityEligibilityGraph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Leave-reach reaction eligibility graph',
    description: 'D&D eligibility of a reaction to a creature leaving reach.',
    document: opportunityEligibilityGraph,
    checksum: checksumRuleDocument(opportunityEligibilityGraph)
  },
  {
    id: movementReactionChoiceGraph.id,
    definitionFamilyKey: GRAPH_FAMILY,
    label: 'Movement reaction choice graph',
    description: 'D&D choice among a reactor’s eligible movement reactions.',
    document: movementReactionChoiceGraph,
    checksum: checksumRuleDocument(movementReactionChoiceGraph)
  }
] as const
