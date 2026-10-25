import {
  initiativeDeclarationSelectionDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  SourceImportBootstrapInput,
  SourceImportDefinitionsInput
} from '@artificer-toolkit/schema/api/sourceImport'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  initiativePolicyReusableDefinitionDocumentDtoSchema,
  type InitiativePolicyReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/initiativePolicy'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { DND5E_INITIATIVE_FACT_KEYS } from '@artificer-toolkit/rules-runtime/systems/dnd5e/initiativeFactAdapter'
import {
  SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS,
  SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH
} from '@artificer-toolkit/source-data/srd/initiativePolicies.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eReactionChoiceDefinition,
  createDnd5eMovementReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import type { z } from 'zod'

type InitiativePolicyInput = Pick<
  InitiativePolicyReusableDefinitionDocumentDto,
  'procedure' | 'cadence'
>

/**
 * The initiative policies' graphs. An actor or side roll runs the one-d20 fixture graph; a declared
 * action roll runs the seeded Speed Factor graph and declaration modifiers, so declared initiative
 * proves the real definition (advantage and disadvantage included), not a stand-in.
 */
export function createEncounterInitiativeDefinitions(
  policies: ReadonlyArray<InitiativePolicyInput>
): { definitions: SourceImportDefinitionsInput['definitions']; policyIds: string[] } {
  const graph = ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    gameSystemId: srdSystemRecord.id,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
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
  } satisfies z.input<typeof ruleGraphDefinitionDtoSchema>)
  const graphChecksum = checksumRuleDocument(graph)
  const declaredGraph = ruleGraphDefinitionDtoSchema.parse({
    ...SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH,
    id: crypto.randomUUID()
  })
  const declaredGraphChecksum = checksumRuleDocument(declaredGraph)
  const choice = ruleGraphDefinitionDtoSchema.parse({
    ...graph,
    id: crypto.randomUUID(),
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
  } satisfies z.input<typeof ruleGraphDefinitionDtoSchema>)
  const choiceChecksum = checksumRuleDocument(choice)
  const pinFor = (procedure: InitiativePolicyInput['procedure']) => ({
    definitionId: procedure === 'DECLARED_ACTION_ROLL' ? declaredGraph.id : graph.id,
    definitionVersion: 1,
    definitionChecksum:
      procedure === 'DECLARED_ACTION_ROLL' ? declaredGraphChecksum : graphChecksum,
    scoreOutput: 'score',
    sortDirection: 'DESCENDING' as const,
    automaticOutput: 'automatic'
  })
  const policyDocuments = policies.map((policy) => {
    const pin = pinFor(policy.procedure)
    return initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'INITIATIVE_POLICY',
      id: crypto.randomUUID(),
      gameSystemId: srdSystemRecord.id,
      procedure: policy.procedure,
      cadence: policy.cadence,
      evaluationGraph: pin,
      orderChoiceGraph: {
        definitionId: choice.id,
        definitionVersion: 1,
        definitionChecksum: choiceChecksum,
        selectionOutput: 'selection',
        minimumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
        maximumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex
      },
      tieResolvers: [{ ...pin, repeatOnTie: false, maximumAttempts: 1 }],
      defaultTieResolverDefinitionId: pin.definitionId,
      ...(policy.procedure === 'DECLARED_ACTION_ROLL'
        ? { declarationModifiers: SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS }
        : {})
    })
  })
  const usesGraph = (declared: boolean) =>
    policies.some((policy) => (policy.procedure === 'DECLARED_ACTION_ROLL') === declared)
  const definitions: SourceImportDefinitionsInput['definitions'] = [
    ...(usesGraph(false)
      ? [
          {
            id: graph.id,
            definitionFamilyKey: graph.definitionFamilyKey,
            label: 'V08 lifecycle D20 initiative',
            description: 'Automatic initiative fixture',
            document: jsonValueSchema.parse(graph),
            checksum: graphChecksum
          }
        ]
      : []),
    ...(usesGraph(true)
      ? [
          {
            id: declaredGraph.id,
            definitionFamilyKey: declaredGraph.definitionFamilyKey,
            label: 'V08 lifecycle declared D20 initiative',
            description: 'The seeded Speed Factor initiative graph',
            document: jsonValueSchema.parse(declaredGraph),
            checksum: declaredGraphChecksum
          }
        ]
      : []),
    {
      id: choice.id,
      definitionFamilyKey: choice.definitionFamilyKey,
      label: 'V08 lifecycle initiative order choice',
      description: 'Automatic initiative fixture',
      document: jsonValueSchema.parse(choice),
      checksum: choiceChecksum
    },
    ...policyDocuments.map((policy, index) => ({
      id: policy.id,
      definitionFamilyKey: 'initiative-policy' as const,
      label: `V08 lifecycle initiative policy ${index + 1}`,
      description: 'Automatic initiative fixture',
      document: jsonValueSchema.parse(policy),
      checksum: checksumRuleDocument(policy)
    }))
  ]
  return { definitions, policyIds: policyDocuments.map((policy) => policy.id) }
}

/** The command a declaring actor's controller sends to settle a pending Initiative declaration. */
export function declarationCommand(input: {
  encounterId: string
  pending: Pick<
    Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'INITIATIVE_DECLARATION' }>,
    'encounterVersion' | 'occurrenceId' | 'occurrenceVersion' | 'primaryOptions' | 'requestId'
  >
  commandId?: string
}): { command: ResolveRuleOccurrenceInputDto } {
  const option = input.pending.primaryOptions[0]
  if (!option) throw new Error('Expected an issued declaration option.')
  const primary = initiativeDeclarationSelectionDtoSchema.parse(
    option.kind === 'GM_ADJUDICATED'
      ? {
          kind: 'GM_ADJUDICATED',
          optionId: 'GM_ADJUDICATED',
          actorSize: 'MEDIUM',
          factorIds: [],
          spellLevel: null
        }
      : { kind: option.kind, optionId: option.optionId }
  )
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: input.encounterId,
      commandId: input.commandId ?? crypto.randomUUID(),
      expectedVersion: input.pending.encounterVersion,
      occurrenceId: input.pending.occurrenceId,
      expectedOccurrenceVersion: input.pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'INITIATIVE_DECLARATION',
        requestId: input.pending.requestId,
        primary,
        bonus: null
      }
    }
  }
}

function createMovementReactionDefinitions(): {
  definitions: SourceImportDefinitionsInput['definitions']
  eligibilityDefinitionId: string
} {
  const choiceTemplate = createDnd5eReactionChoiceDefinition()
  const choiceDefinition = ruleGraphDefinitionDtoSchema.parse({
    ...choiceTemplate.definition,
    id: crypto.randomUUID()
  })
  const choice = serverPublishedRuleDefinitionDtoSchema.parse({
    ...choiceTemplate,
    id: choiceDefinition.id,
    checksum: checksumRuleDocument(choiceDefinition),
    definition: choiceDefinition
  })
  const eligibilityTemplate = createDnd5eMovementReactionEligibilityDefinition({
    definitionId: crypto.randomUUID(),
    stage: 'BEFORE_LEAVE_REACH'
  })
  const eligibilityDefinition = ruleGraphDefinitionDtoSchema.parse({
    ...eligibilityTemplate.definition,
    outputs: {
      ...eligibilityTemplate.definition.outputs,
      choiceDefinitionId: { kind: 'LITERAL', value: choice.id }
    }
  })
  const eligibility = serverPublishedRuleDefinitionDtoSchema.parse({
    ...eligibilityTemplate,
    checksum: checksumRuleDocument(eligibilityDefinition),
    definition: eligibilityDefinition
  })
  return {
    eligibilityDefinitionId: eligibility.id,
    definitions: [eligibility, choice].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'V08 lifecycle movement reaction policy',
      description: 'Isolated D&D movement reaction browser policy.',
      document: jsonValueSchema.parse(published.definition),
      checksum: published.checksum
    }))
  }
}

export function createEncounterLifecyclePolicyFixture(
  ownerUserId: string,
  options: { includeMovementReactionPolicies?: boolean } = {}
) {
  const scenarios = [
    { rolls: 'AUTO_ROLL', procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' },
    { rolls: 'AUTO_ROLL', procedure: 'SIDE_ROLL', cadence: 'EACH_ROUND' },
    { rolls: 'PROMPT', procedure: 'SIDE_ROLL', cadence: 'ENCOUNTER_START' },
    { rolls: 'PROMPT', procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' }
  ] as const
  const initiative = createEncounterInitiativeDefinitions(scenarios)
  const movementReaction = options.includeMovementReactionPolicies
    ? createMovementReactionDefinitions()
    : null
  const definitions = [...initiative.definitions, ...(movementReaction?.definitions ?? [])]
  const system = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
  const metadata = {
    gameSystemId: srdSystemRecord.id,
    code: `v08-${ownerUserId}`,
    label: 'V08 lifecycle fixture',
    description: 'Isolated V08 lifecycle acceptance policies.'
  }
  const bootstrap: SourceImportBootstrapInput = {
    systems: [{ id: srdSystemRecord.id, document: system, checksum: checksumRuleDocument(system) }],
    contentSource: { ...metadata, id: crypto.randomUUID(), kind: 'PLATFORM', ownerUserId: null },
    catalogue: { ...metadata, id: crypto.randomUUID() }
  }
  const imported: SourceImportDefinitionsInput = {
    contentSourceId: bootstrap.contentSource.id,
    definitions
  }
  return {
    bootstrap,
    imported,
    scenarios: scenarios.map((scenario, index) => ({
      ...scenario,
      definitionId: initiative.policyIds[index]!
    })),
    movementReaction: movementReaction && {
      eligibilityDefinitionId: movementReaction.eligibilityDefinitionId
    },
    cleanup: {
      ownerUserId,
      contentSourceId: bootstrap.contentSource.id,
      catalogueId: bootstrap.catalogue.id,
      definitionIds: definitions.map((definition) => definition.id)
    }
  }
}
