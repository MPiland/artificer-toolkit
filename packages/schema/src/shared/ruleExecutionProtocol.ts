import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { ruleValueDtoSchema } from '../api/rulesRuntime.js'
import { initiativeDeclarationAdjudicationFieldDtoSchema } from './encounterRuleOccurrence.js'
import { serverRuleEvidenceResponseDtoSchema } from './ruleExecutionEvidence.js'
import {
  compiledRuleGraphDtoSchema,
  ruleGraphSourceIdentityDtoSchema,
  serverRuleExecutionTraceEntryDtoSchema
} from './ruleExecutionCore.js'
import {
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionPortNameSchema as portNameSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { serverUuidIdentityDtoSchema } from './serverUuidIdentity.js'

export const serverRuleIntegerRangeRequestDtoSchema = lazySchema(() =>
  z
    .strictObject({
      requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
      kind: z.literal('INTEGER_RANGE'),
      nodeId: localNodeIdSchema,
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(RULE_GRAPH_LIMITS.NODES - 1)),
      min: integerSchema,
      max: integerSchema
    })
    .check(
      z.refine(
        (request) => request.min <= request.max,
        'Integer-range request bounds must be ordered.'
      )
    )
)

const initiativeDeclarationOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum([
      'CHARACTER_ACTION',
      'CHARACTER_SPELL_CAST',
      'CREATURE_FEATURE_ACTION',
      'GM_ADJUDICATED'
    ]),
    optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
    selectionContract: checksumSchema
  })
)

export const serverInitiativeDeclarationRequestDtoSchema = lazySchema(() =>
  z
    .strictObject({
      requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
      kind: z.literal('INITIATIVE_DECLARATION'),
      encounterId: uuidSchema,
      round: positiveIntegerSchema,
      actorId: uuidSchema,
      participantExpectedVersion: integerSchema.check(z.gte(0)),
      primaryOptions: z
        .array(initiativeDeclarationOptionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      bonusOptions: z
        .array(initiativeDeclarationOptionDtoSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      adjudicationFields: z
        .array(initiativeDeclarationAdjudicationFieldDtoSchema)
        .check(z.maxLength(3)),
      controllerUserId: z.nullable(uuidSchema),
      sourceOptionsChecksum: checksumSchema
    })
    .check(
      z.superRefine((value, context) => {
        for (const [key, options] of [
          ['primaryOptions', value.primaryOptions],
          ['bonusOptions', value.bonusOptions]
        ] as const) {
          if (
            options.some(
              (option, index) => index > 0 && options[index - 1]!.optionId >= option.optionId
            )
          ) {
            context.addIssue({
              code: 'custom',
              path: [key],
              message: 'Declaration options must be sorted and unique.'
            })
          }
        }
      })
    )
)

export const serverRuleExecutionRequestDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    serverRuleIntegerRangeRequestDtoSchema,
    serverInitiativeDeclarationRequestDtoSchema
  ])
)

export const serverRuleExecutionContinuationDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    graph: compiledRuleGraphDtoSchema,
    facts: z.record(capabilityKeySchema, ruleValueDtoSchema).check(
      z.refine((facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
        message: `Rule continuations support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} runtime facts.`
      })
    ),
    nextNodeIndex: z
      .number()
      .check(z.int())
      .check(z.gte(0))
      .check(z.lte(RULE_GRAPH_LIMITS.NODES - 1)),
    nodeOutputs: z.record(localNodeIdSchema, z.record(portNameSchema, ruleValueDtoSchema)),
    trace: z
      .array(serverRuleExecutionTraceEntryDtoSchema)
      .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
    // Kernel continuations carry only kernel evidence requests. Aggregate
    // declaration intent is sealed by the aggregate-choice snapshot.
    request: serverRuleIntegerRangeRequestDtoSchema,
    authority: z.literal('APPLICATION_SERVICE'),
    redaction: z.literal('SERVER_ONLY'),
    seal: checksumSchema
  })
)

/** Trusted parent-command correlation retained as canonical audit identity. */
export const serverRuleExecutionCorrelationIdDtoSchema = lazySchema(() =>
  z.nullable(serverUuidIdentityDtoSchema)
)

export const serverRuleExecutionResumeInputDtoSchema = lazySchema(() =>
  z.strictObject({
    continuation: serverRuleExecutionContinuationDtoSchema,
    response: serverRuleEvidenceResponseDtoSchema
  })
)

/**
 * Server-only evidence. It may contain private consumed facts and operation values. Product services
 * must project/redact domain results before returning anything to a browser or live-session client.
 */
export const serverCompletedRuleExecutionDtoSchema = lazySchema(() =>
  z.strictObject({
    status: z.literal('COMPLETE'),
    outputs: z.record(portNameSchema, ruleValueDtoSchema),
    movementInterruption: z.optional(
      z.union([z.null(), z.strictObject({ kind: z.literal('STOP') })])
    ),
    evidence: z.strictObject({
      source: ruleGraphSourceIdentityDtoSchema,
      capabilityContractVersion: contractVersionSchema,
      facts: z.record(capabilityKeySchema, ruleValueDtoSchema),
      sourceEntryBindings: compiledRuleGraphDtoSchema.shape.sourceEntryBindings,
      vocabularyBindings: compiledRuleGraphDtoSchema.shape.vocabularyBindings,
      trace: z
        .array(serverRuleExecutionTraceEntryDtoSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      outputs: z.record(portNameSchema, ruleValueDtoSchema)
    })
  })
)

/**
 * A bounded action occurrence may execute an authored TEST phase and then one
 * selected OUTCOME phase. The executable plan itself is retained only by a
 * pending occurrence; this receipt records immutable identities and evidence.
 */
export const ruleExecutionPhaseReceiptDtoSchema = lazySchema(() =>
  z
    .strictObject({
      phase: z.enum(['TEST', 'OUTCOME']),
      template: ruleGraphSourceIdentityDtoSchema,
      boundFactsChecksum: checksumSchema,
      specializedChecksum: checksumSchema,
      execution: serverCompletedRuleExecutionDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        const source = value.execution.evidence.source
        if (
          source.definitionId !== value.template.definitionId ||
          source.gameSystemId !== value.template.gameSystemId ||
          source.definitionFamilyKey !== value.template.definitionFamilyKey ||
          source.checksum !== value.specializedChecksum
        )
          context.addIssue({
            code: 'custom',
            path: ['execution', 'evidence', 'source'],
            message: 'Phase receipt execution must match its sealed source identity.'
          })
      })
    )
)

export const ruleExecutionPhaseReceiptsDtoSchema = lazySchema(() =>
  z
    .array(ruleExecutionPhaseReceiptDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(2))
    .check(
      z.superRefine((phases, context) => {
        if (phases[0]?.phase !== 'TEST') {
          context.addIssue({
            code: 'custom',
            path: [0, 'phase'],
            message: 'A phased action receipt must begin with its TEST phase.'
          })
        }
        if (phases.length === 2 && phases[1]?.phase !== 'OUTCOME') {
          context.addIssue({
            code: 'custom',
            path: [1, 'phase'],
            message: 'A phased action may retain only one OUTCOME phase after TEST.'
          })
        }
      })
    )
)

export const serverRuleExecutionResultDtoSchema = lazySchema(() =>
  z.discriminatedUnion('status', [
    serverCompletedRuleExecutionDtoSchema,
    z.strictObject({
      status: z.literal('PAUSED'),
      continuation: serverRuleExecutionContinuationDtoSchema
    })
  ])
)

export type ServerInitiativeDeclarationRequestDto = z.infer<
  typeof serverInitiativeDeclarationRequestDtoSchema
>
export type ServerCompletedRuleExecutionDto = z.infer<typeof serverCompletedRuleExecutionDtoSchema>
export type RuleExecutionPhaseReceiptDto = z.infer<typeof ruleExecutionPhaseReceiptDtoSchema>
export type RuleExecutionPhaseReceiptsDto = z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema>
export type ServerRuleExecutionContinuationDto = z.infer<
  typeof serverRuleExecutionContinuationDtoSchema
>
export type ServerRuleExecutionResumeInputDto = z.infer<
  typeof serverRuleExecutionResumeInputDtoSchema
>
export type ServerRuleExecutionResultDto = z.infer<typeof serverRuleExecutionResultDtoSchema>
export type ServerRuleExecutionCorrelationIdDto = z.infer<
  typeof serverRuleExecutionCorrelationIdDtoSchema
>
