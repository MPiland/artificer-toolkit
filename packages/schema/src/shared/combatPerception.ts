import { z } from 'zod'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { measurementUnitCodeSchema } from './enums.js'
import { postgresUuidSchema } from './postgresUuid.js'

const uuidSchema = postgresUuidSchema.transform((value) => value.toLowerCase())

export const combatPerceptionChannelDtoSchema = z.enum([
  'VISUAL',
  'AUDITORY',
  'VIBRATION',
  'NONVISUAL'
])
export const combatPerceptionAccessGradeDtoSchema = z.enum(['DETECTED', 'LOCATED', 'PRECISE'])
export const combatPerceptionRequirementDtoSchema = z.enum(['DETECT', 'LOCATE', 'PRECISE', 'SEE'])
export const combatPerceptionIlluminationDtoSchema = z.enum([
  'BRIGHT',
  'DIM',
  'ORDINARY_DARKNESS',
  'MAGICAL_DARKNESS'
])
export const combatPerceptionObscurementDtoSchema = z.enum(['NONE', 'LIGHT', 'HEAVY'])
export const combatPerceptionIlluminationAccessDtoSchema = z.enum([
  'BRIGHT_ONLY',
  'DIM',
  'ORDINARY_DARKNESS',
  'MAGICAL_DARKNESS',
  'IGNORE'
])
export const combatPerceptionObscurementAccessDtoSchema = z.enum([
  'NONE',
  'LIGHT',
  'HEAVY',
  'IGNORE'
])
export const combatPerceptionPhysicalConstraintDtoSchema = z.enum([
  'LINE_OF_EFFECT',
  'SHARED_SURFACE'
])

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isCanonicalOrder(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value)
}

function canonicalStringArray<T extends z.ZodType<string>>(
  item: T,
  maximum: number,
  message: string
) {
  return z
    .array(item)
    .max(maximum)
    .superRefine((values, context) => {
      if (!uniqueValues(values))
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${message} must be unique.` })
      if (!isCanonicalOrder(values))
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${message} must be sorted.` })
    })
}

export const combatPerceptionCapabilityDtoSchema = z
  .strictObject({
    channel: combatPerceptionChannelDtoSchema,
    accessGrade: combatPerceptionAccessGradeDtoSchema,
    satisfies: z
      .array(combatPerceptionRequirementDtoSchema)
      .min(1)
      .max(4)
      .refine(uniqueValues, 'Perception capability requirements must be unique.'),
    illuminationAccess: combatPerceptionIlluminationAccessDtoSchema,
    obscurementAccess: combatPerceptionObscurementAccessDtoSchema,
    perceivesInvisible: z.boolean(),
    physicalConstraints: z
      .array(combatPerceptionPhysicalConstraintDtoSchema)
      .max(2)
      .refine(uniqueValues, 'Perception capability physical constraints must be unique.')
  })
  .superRefine((capability, context) => {
    const requiresLocated = capability.satisfies.includes('LOCATE')
    const requiresPrecise =
      capability.satisfies.includes('PRECISE') || capability.satisfies.includes('SEE')

    if (requiresLocated && capability.accessGrade === 'DETECTED') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accessGrade'],
        message: 'LOCATE requires a LOCATED or PRECISE capability.'
      })
    }
    if (requiresPrecise && capability.accessGrade !== 'PRECISE') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accessGrade'],
        message: 'PRECISE and SEE require a PRECISE capability.'
      })
    }
  })

/** UUID-backed semantic definition; range belongs to the grant or actor source. */
export const senseReusableDefinitionDocumentDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('SENSE'),
  id: uuidSchema,
  gameSystemId: uuidSchema,
  capabilities: z.array(combatPerceptionCapabilityDtoSchema).min(1).max(8)
})

const contributionIdentitySchema = z.strictObject({
  id: uuidSchema,
  order: z.number().int().min(0).max(9_999)
})

const contributionMeasurementSchema = z.strictObject({
  amount: z.number().finite().min(0),
  unit: measurementUnitCodeSchema
})

const pinnedSenseContributionFields = {
  senseDefinitionId: uuidSchema,
  definitionVersion: z.number().int().positive(),
  definitionContractVersion: z.number().int().positive().max(10_000),
  definitionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  document: senseReusableDefinitionDocumentDtoSchema
}

const senseGrantContributionDtoSchema = contributionIdentitySchema
  .extend({
    kind: z.literal('SENSE_GRANT'),
    ...pinnedSenseContributionFields,
    range: contributionMeasurementSchema.nullable()
  })
  .superRefine((contribution, context) => {
    if (contribution.document.id !== contribution.senseDefinitionId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document', 'id'],
        message: 'Sense grant document identity must match its pinned sense definition.'
      })
    if (checksumRuleDocument(contribution.document) !== contribution.definitionChecksum)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['definitionChecksum'],
        message: 'Sense grant checksum must match its pinned sense definition document.'
      })
  })

const senseSuppressContributionDtoSchema = contributionIdentitySchema
  .extend({
    kind: z.literal('SENSE_SUPPRESS'),
    senseDefinitionIds: canonicalStringArray(
      uuidSchema,
      32,
      'Suppressed sense definition identities'
    ),
    channels: canonicalStringArray(combatPerceptionChannelDtoSchema, 4, 'Suppressed channels')
  })
  .superRefine((contribution, context) => {
    if (contribution.senseDefinitionIds.length === 0 && contribution.channels.length === 0)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sense suppression requires a sense definition or channel.'
      })
  })

const accessLimitContributionDtoSchema = contributionIdentitySchema
  .extend({
    kind: z.literal('ACCESS_LIMIT'),
    channels: canonicalStringArray(combatPerceptionChannelDtoSchema, 4, 'Limited channels').min(1),
    maximumAccessGrade: combatPerceptionAccessGradeDtoSchema.nullable(),
    maximumIlluminationAccess: combatPerceptionIlluminationAccessDtoSchema.nullable(),
    maximumObscurementAccess: combatPerceptionObscurementAccessDtoSchema.nullable(),
    perceivesInvisible: z.literal(false).nullable()
  })
  .superRefine((contribution, context) => {
    if (
      contribution.maximumAccessGrade === null &&
      contribution.maximumIlluminationAccess === null &&
      contribution.maximumObscurementAccess === null &&
      contribution.perceivesInvisible === null
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Access limits require at least one limit.'
      })
  })

const emissionSuppressContributionDtoSchema = contributionIdentitySchema.extend({
  kind: z.literal('EMISSION_SUPPRESS'),
  channels: canonicalStringArray(
    combatPerceptionChannelDtoSchema,
    4,
    'Suppressed emission channels'
  ).min(1),
  bypass: z.enum(['NONE', 'INVISIBILITY'])
})

const illuminationEffectContributionDtoSchema = contributionIdentitySchema
  .extend({
    kind: z.literal('ILLUMINATION_EFFECT'),
    illumination: combatPerceptionIlluminationDtoSchema.nullable(),
    obscurement: combatPerceptionObscurementDtoSchema.nullable(),
    precedence: z.number().int().min(-10_000).max(10_000)
  })
  .superRefine((contribution, context) => {
    if (contribution.illumination === null && contribution.obscurement === null)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Illumination effects require illumination or obscurement.'
      })
  })

export const combatPerceptionContributionDtoSchema = z.discriminatedUnion('kind', [
  senseGrantContributionDtoSchema,
  senseSuppressContributionDtoSchema,
  accessLimitContributionDtoSchema,
  emissionSuppressContributionDtoSchema,
  illuminationEffectContributionDtoSchema
])

export const combatPerceptionContributionsDtoSchema = z
  .array(combatPerceptionContributionDtoSchema)
  .max(32)
  .superRefine((contributions, context) => {
    const ids = contributions.map((contribution) => contribution.id)
    if (!uniqueValues(ids))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Perception contribution identities must be unique.'
      })
    if (
      contributions.some((contribution, index) => {
        const prior = contributions[index - 1]
        return (
          prior !== undefined &&
          (prior.order > contribution.order ||
            (prior.order === contribution.order && prior.id >= contribution.id))
        )
      })
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Perception contributions must be ordered by order then identity.'
      })
  })

export type CombatPerceptionChannelDto = z.infer<typeof combatPerceptionChannelDtoSchema>
export type CombatPerceptionAccessGradeDto = z.infer<typeof combatPerceptionAccessGradeDtoSchema>
export type CombatPerceptionRequirementDto = z.infer<typeof combatPerceptionRequirementDtoSchema>
export type CombatPerceptionIlluminationDto = z.infer<typeof combatPerceptionIlluminationDtoSchema>
export type CombatPerceptionObscurementDto = z.infer<typeof combatPerceptionObscurementDtoSchema>
export type CombatPerceptionIlluminationAccessDto = z.infer<
  typeof combatPerceptionIlluminationAccessDtoSchema
>
export type CombatPerceptionObscurementAccessDto = z.infer<
  typeof combatPerceptionObscurementAccessDtoSchema
>
export type CombatPerceptionPhysicalConstraintDto = z.infer<
  typeof combatPerceptionPhysicalConstraintDtoSchema
>
export type CombatPerceptionCapabilityDto = z.infer<typeof combatPerceptionCapabilityDtoSchema>
export type SenseReusableDefinitionDocumentDto = z.infer<
  typeof senseReusableDefinitionDocumentDtoSchema
>
export type CombatPerceptionContributionDto = z.infer<typeof combatPerceptionContributionDtoSchema>
export type CombatPerceptionContributionsDto = z.infer<
  typeof combatPerceptionContributionsDtoSchema
>
