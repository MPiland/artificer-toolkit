import { z, lazySchema } from '../zod.js'

import { ruleCapabilityKeyDtoSchema, ruleGraphPortNameDtoSchema } from '../api/rulesRuntime.js'
import { equipmentPropertyCodeSchema } from './enums.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'
import { postgresUuidSchema } from './postgresUuid.js'

const serverUuidIdentityDtoSchema = lazySchema(() =>
  z.pipe(
    postgresUuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)

const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
const positiveVersionSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.positive()).check(z.lte(10_000))
)

export const initiativeProcedureDtoSchema = lazySchema(() =>
  z.enum(['ACTOR_ROLL', 'ACTOR_SCORE', 'SIDE_ROLL', 'DECLARED_ACTION_ROLL'])
)
export const initiativeCadenceDtoSchema = lazySchema(() =>
  z.enum(['ENCOUNTER_START', 'EACH_ROUND'])
)

export const initiativePolicyExactGraphPinDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: serverUuidIdentityDtoSchema,
    definitionVersion: positiveVersionSchema,
    definitionChecksum: checksumSchema
  })
)

export const initiativePolicyGraphPinDtoSchema = lazySchema(() =>
  z.extend(initiativePolicyExactGraphPinDtoSchema, {
    scoreOutput: ruleGraphPortNameDtoSchema,
    sortDirection: z.enum(['ASCENDING', 'DESCENDING']),
    automaticOutput: ruleGraphPortNameDtoSchema
  })
)

export const initiativePolicyTieResolverPinDtoSchema = lazySchema(() =>
  z
    .extend(initiativePolicyGraphPinDtoSchema, {
      repeatOnTie: z.boolean(),
      maximumAttempts: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))
    })
    .check(
      z.superRefine((pin, context) => {
        if (!pin.repeatOnTie && pin.maximumAttempts !== 1) {
          context.addIssue({
            code: 'custom',
            path: ['maximumAttempts'],
            message: 'A non-repeating initiative tie resolver must allow exactly one attempt.'
          })
        }
        if (pin.repeatOnTie && pin.maximumAttempts < 2) {
          context.addIssue({
            code: 'custom',
            path: ['maximumAttempts'],
            message: 'A repeating initiative tie resolver must allow at least two attempts.'
          })
        }
      })
    )
)

export const initiativePolicyOrderChoiceGraphPinDtoSchema = lazySchema(() =>
  z
    .extend(initiativePolicyExactGraphPinDtoSchema, {
      selectionOutput: ruleGraphPortNameDtoSchema,
      minimumIndexFact: ruleCapabilityKeyDtoSchema,
      maximumIndexFact: ruleCapabilityKeyDtoSchema
    })
    .check(
      z.superRefine((pin, context) => {
        if (pin.minimumIndexFact === pin.maximumIndexFact) {
          context.addIssue({
            code: 'custom',
            path: ['maximumIndexFact'],
            message: 'Initiative order-choice bounds must use distinct System fact keys.'
          })
        }
      })
    )
)

const declarationModifierSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.gte(-100)).check(z.lte(100))
)

function uniqueBy<T>(key: (value: T) => string, message: string) {
  return z.superRefine<T[]>((values, context) => {
    const seen = new Set<string>()
    for (const [index, value] of values.entries()) {
      if (seen.has(key(value))) context.addIssue({ code: 'custom', path: [index], message })
      seen.add(key(value))
    }
  })
}

/**
 * The authored numbers a declared-action initiative policy adds to each actor's
 * roll: one modifier for the actor's size, each factor at most once when the
 * declared action's equipment carries every property of one of its sets (or a
 * GM picks it), and the highest declared spell level times `modifierPerLevel`.
 */
export const initiativeDeclarationModifiersDtoSchema = lazySchema(() =>
  z.strictObject({
    sizes: z
      .array(z.strictObject({ size: systemCoreCodeSchema, modifier: declarationModifierSchema }))
      .check(z.minLength(1))
      .check(z.maxLength(16))
      .check(uniqueBy(({ size }) => size, 'Declared initiative sizes must be unique.')),
    factors: z
      .array(
        z.strictObject({
          id: serverUuidIdentityDtoSchema,
          label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
          equipmentPropertySets: z
            .array(z.array(equipmentPropertyCodeSchema).check(z.minLength(1)).check(z.maxLength(8)))
            .check(z.minLength(1))
            .check(z.maxLength(8)),
          modifier: declarationModifierSchema
        })
      )
      .check(z.maxLength(32))
      .check(uniqueBy(({ id }) => id, 'Declared initiative factor IDs must be unique.')),
    spellLevel: z.strictObject({ modifierPerLevel: declarationModifierSchema })
  })
)

const initiativePolicyDocumentBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('INITIATIVE_POLICY'),
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    cadence: initiativeCadenceDtoSchema,
    evaluationGraph: initiativePolicyGraphPinDtoSchema,
    orderChoiceGraph: initiativePolicyOrderChoiceGraphPinDtoSchema,
    tieResolvers: z
      .array(initiativePolicyTieResolverPinDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(8))
      .check(
        uniqueBy(
          ({ definitionId }) => definitionId,
          'Initiative tie resolver definition IDs must be unique.'
        )
      ),
    defaultTieResolverDefinitionId: serverUuidIdentityDtoSchema
  })
)

export const initiativePolicyReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z
    .discriminatedUnion('procedure', [
      z.extend(initiativePolicyDocumentBaseDtoSchema, {
        procedure: z.enum(['ACTOR_ROLL', 'ACTOR_SCORE', 'SIDE_ROLL'])
      }),
      z.extend(initiativePolicyDocumentBaseDtoSchema, {
        procedure: z.literal('DECLARED_ACTION_ROLL'),
        declarationModifiers: initiativeDeclarationModifiersDtoSchema
      })
    ])
    .check(
      z.superRefine((document, context) => {
        if (
          !document.tieResolvers.some(
            (pin) => pin.definitionId === document.defaultTieResolverDefinitionId
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['defaultTieResolverDefinitionId'],
            message: "The default tie resolver must be one of this policy's tie resolvers."
          })
        }
        if (document.orderChoiceGraph.definitionId === document.evaluationGraph.definitionId) {
          context.addIssue({
            code: 'custom',
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
            code: 'custom',
            path: ['orderChoiceGraph', 'definitionId'],
            message: 'Initiative order-choice graph must be distinct from each tie resolver.'
          })
        }
      })
    )
)

export type InitiativePolicyGraphPinDto = z.infer<typeof initiativePolicyGraphPinDtoSchema>
export type InitiativePolicyTieResolverPinDto = z.infer<
  typeof initiativePolicyTieResolverPinDtoSchema
>
export type InitiativePolicyOrderChoiceGraphPinDto = z.infer<
  typeof initiativePolicyOrderChoiceGraphPinDtoSchema
>
export type InitiativeDeclarationModifiersDto = z.infer<
  typeof initiativeDeclarationModifiersDtoSchema
>
export type InitiativePolicyReusableDefinitionDocumentDto = z.infer<
  typeof initiativePolicyReusableDefinitionDocumentDtoSchema
>
