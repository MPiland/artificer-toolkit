import { z } from '../zod.js'

import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules/contributors'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionReceiptD20FaceSchema as receiptD20FaceSchema
} from './ruleExecutionPrimitives.js'

export const serverRuleEvidenceResponseDtoSchema = z.strictObject({
  requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
  value: integerSchema
})

const resolvedIntentKeySchema = z.string().check(z.regex(/^[a-z][a-zA-Z0-9_-]{0,79}$/))
const resolvedIntentValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string().check(z.maxLength(256))
])
export const resolvedStartIntentRecordDtoSchema = z
  .record(resolvedIntentKeySchema, resolvedIntentValueSchema)
  .check(
    z.refine((intent) => Object.keys(intent).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
      message: `Resolved rule execution intents support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} values.`
    })
  )

/** One bounded TEST/OUTCOME execution may consume no more than this many server evidence requests. */
export const MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS = 32

export const receiptD20ContributorSchema = z.strictObject({
  sourceId: identifierSchema,
  grantId: z.nullable(identifierSchema),
  domainKey: z.nullable(identifierSchema),
  influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
})

const concentrationContributorDtoSchema = z.strictObject({
  sourceId: identifierSchema,
  grantId: z.nullable(identifierSchema),
  domainKey: z.nullable(identifierSchema),
  influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
})

export const canonicalConcentrationContributorsDtoSchema = z
  .array(concentrationContributorDtoSchema)
  .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
  .check(
    z.superRefine((contributors, context) => {
      let prior: z.infer<typeof concentrationContributorDtoSchema> | null = null
      for (const [index, contributor] of contributors.entries()) {
        if (prior !== null && compareCanonicalD20Contributors(prior, contributor) >= 0)
          context.addIssue({
            code: 'custom',
            path: [index],
            message: 'Concentration contributors must be unique and in canonical order.'
          })
        prior = contributor
      }
    })
  )

/** Server-only policy for one frozen d20 evidence node. */
export const serverRuleExecutionD20PolicyDtoSchema = z
  .strictObject({
    requestNodeId: localNodeIdSchema,
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    contributors: z.array(receiptD20ContributorSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
    contributorChecksum: checksumSchema,
    modifier: integerSchema,
    dc: integerSchema
  })
  .check(
    z.superRefine((value, context) => {
      if (
        value.contributors.some(
          (contributor, index) =>
            index > 0 &&
            compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['contributors'],
          message: 'd20 policy contributors must be strictly sorted and unique.'
        })
      }
    })
  )

const serverRuleExecutionD20EvidenceShape = z.strictObject({
  requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
  /** The mode the faces were rolled with: the roller may change the recommended mode. */
  rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
  /** The rules-derived mode the roll prompt recommended. */
  derivedRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
  rawFaces: z.array(receiptD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
  selectedNatural: receiptD20FaceSchema,
  contributors: z.array(receiptD20ContributorSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
  contributorChecksum: checksumSchema,
  modifier: integerSchema,
  total: integerSchema,
  defenseOrDc: integerSchema,
  resultPath: identifierSchema
})

function validateServerRuleExecutionD20Evidence(
  value: z.infer<typeof serverRuleExecutionD20EvidenceShape>,
  context: z.core.$RefinementCtx
): void {
  const expectedFaces = value.rollMode === 'NORMAL' ? 1 : 2
  if (value.rawFaces.length !== expectedFaces)
    context.addIssue({
      code: 'custom',
      path: ['rawFaces'],
      message: 'd20 evidence face count is invalid.'
    })
  const expectedSelected =
    value.rollMode === 'ADVANTAGE'
      ? Math.max(...value.rawFaces)
      : value.rollMode === 'DISADVANTAGE'
        ? Math.min(...value.rawFaces)
        : value.rawFaces[0]
  if (value.selectedNatural !== expectedSelected)
    context.addIssue({
      code: 'custom',
      path: ['selectedNatural'],
      message: 'd20 evidence selected face is invalid.'
    })
  if (value.total !== value.selectedNatural + value.modifier)
    context.addIssue({
      code: 'custom',
      path: ['total'],
      message: 'd20 evidence total is invalid.'
    })
  if (
    value.contributors.some(
      (contributor, index) =>
        index > 0 &&
        compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
    )
  )
    context.addIssue({
      code: 'custom',
      path: ['contributors'],
      message: 'd20 evidence contributors must be strictly sorted and unique.'
    })
  if (checksumRuleDocument(value.contributors) !== value.contributorChecksum)
    context.addIssue({
      code: 'custom',
      path: ['contributorChecksum'],
      message: 'd20 evidence contributor checksum is invalid.'
    })
}

export const serverRuleExecutionD20EvidenceDtoSchema = serverRuleExecutionD20EvidenceShape.check(
  z.superRefine(validateServerRuleExecutionD20Evidence)
)

/** Exact graph binding retained only for a direct-action OUTCOME nested d20. */
export const serverRuleExecutionNestedD20EvidenceDtoSchema = z
  .extend(serverRuleExecutionD20EvidenceShape, { requestNodeId: localNodeIdSchema })
  .check(z.superRefine(validateServerRuleExecutionD20Evidence))
  .check(
    z.superRefine((value, context) => {
      const influences = new Set(value.contributors.map((contributor) => contributor.influence))
      const expectedRollMode =
        influences.size === 1
          ? [...influences][0] === 'ADVANTAGE'
            ? 'ADVANTAGE'
            : 'DISADVANTAGE'
          : 'NORMAL'
      if (value.derivedRollMode !== expectedRollMode)
        context.addIssue({
          code: 'custom',
          path: ['derivedRollMode'],
          message: 'Nested d20 evidence roll mode must match its contributors.'
        })
    })
  )

export type ServerRuleExecutionD20EvidenceDto = z.infer<
  typeof serverRuleExecutionD20EvidenceDtoSchema
>
export type ServerRuleExecutionNestedD20EvidenceDto = z.infer<
  typeof serverRuleExecutionNestedD20EvidenceDtoSchema
>
export type ServerRuleExecutionD20PolicyDto = z.infer<typeof serverRuleExecutionD20PolicyDtoSchema>
