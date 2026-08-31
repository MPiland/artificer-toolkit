import { z } from 'zod'

import { ruleCapabilityKeyDtoSchema, ruleGraphPortNameDtoSchema } from '../api/rulesRuntime.js'
import { postgresUuidSchema } from './postgresUuid.js'

const serverUuidIdentityDtoSchema = postgresUuidSchema.transform((value) => value.toLowerCase())

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const positiveVersionSchema = z.number().int().positive().max(10_000)

export const initiativeProcedureDtoSchema = z.enum([
  'ACTOR_ROLL',
  'ACTOR_SCORE',
  'SIDE_ROLL',
  'DECLARED_ACTION_ROLL'
])
export const initiativeCadenceDtoSchema = z.enum(['ENCOUNTER_START', 'EACH_ROUND'])

export const initiativePolicyExactGraphPinDtoSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  definitionVersion: positiveVersionSchema,
  definitionChecksum: checksumSchema
})

export const initiativePolicyGraphPinDtoSchema = initiativePolicyExactGraphPinDtoSchema.extend({
  scoreOutput: ruleGraphPortNameDtoSchema,
  sortDirection: z.enum(['ASCENDING', 'DESCENDING']),
  automaticOutput: ruleGraphPortNameDtoSchema
})

export const initiativePolicyTieResolverPinDtoSchema = initiativePolicyGraphPinDtoSchema
  .extend({
    repeatOnTie: z.boolean(),
    maximumAttempts: z.number().int().min(1).max(20)
  })
  .superRefine((pin, context) => {
    if (!pin.repeatOnTie && pin.maximumAttempts !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumAttempts'],
        message: 'A non-repeating initiative tie resolver must allow exactly one attempt.'
      })
    }
    if (pin.repeatOnTie && pin.maximumAttempts < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumAttempts'],
        message: 'A repeating initiative tie resolver must allow at least two attempts.'
      })
    }
  })

export const initiativePolicyOrderChoiceGraphPinDtoSchema = initiativePolicyExactGraphPinDtoSchema
  .extend({
    selectionOutput: ruleGraphPortNameDtoSchema,
    minimumIndexFact: ruleCapabilityKeyDtoSchema,
    maximumIndexFact: ruleCapabilityKeyDtoSchema
  })
  .superRefine((pin, context) => {
    if (pin.minimumIndexFact === pin.maximumIndexFact) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumIndexFact'],
        message: 'Initiative order-choice bounds must use distinct System fact keys.'
      })
    }
  })

export const initiativePolicyReusableDefinitionDocumentDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('INITIATIVE_POLICY'),
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    procedure: initiativeProcedureDtoSchema,
    cadence: initiativeCadenceDtoSchema,
    evaluationGraph: initiativePolicyGraphPinDtoSchema,
    orderChoiceGraph: initiativePolicyOrderChoiceGraphPinDtoSchema,
    tieResolvers: z
      .array(initiativePolicyTieResolverPinDtoSchema)
      .min(1)
      .max(8)
      .superRefine((pins, context) => {
        const ids = new Set<string>()
        for (const [index, pin] of pins.entries()) {
          if (ids.has(pin.definitionId)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'definitionId'],
              message: 'Initiative tie resolver definition IDs must be unique.'
            })
          }
          ids.add(pin.definitionId)
        }
      }),
    defaultTieResolverDefinitionId: serverUuidIdentityDtoSchema
  })
  .superRefine((document, context) => {
    if (
      !document.tieResolvers.some(
        (pin) => pin.definitionId === document.defaultTieResolverDefinitionId
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultTieResolverDefinitionId'],
        message: "The default tie resolver must be one of this policy's tie resolvers."
      })
    }
    if (document.orderChoiceGraph.definitionId === document.evaluationGraph.definitionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderChoiceGraph', 'definitionId'],
        message: 'Initiative order-choice graph must be distinct from the evaluation graph.'
      })
    }
    if (
      document.tieResolvers.some(
        (pin) => pin.definitionId === document.orderChoiceGraph.definitionId
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderChoiceGraph', 'definitionId'],
        message: 'Initiative order-choice graph must be distinct from each tie resolver.'
      })
    }
  })

export type InitiativePolicyGraphPinDto = z.infer<typeof initiativePolicyGraphPinDtoSchema>
export type InitiativePolicyTieResolverPinDto = z.infer<
  typeof initiativePolicyTieResolverPinDtoSchema
>
export type InitiativePolicyOrderChoiceGraphPinDto = z.infer<
  typeof initiativePolicyOrderChoiceGraphPinDtoSchema
>
export type InitiativePolicyReusableDefinitionDocumentDto = z.infer<
  typeof initiativePolicyReusableDefinitionDocumentDtoSchema
>
