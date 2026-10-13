import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import { authoredLengthAmountSchema } from './authoredLimits.js'
import { lengthUnitCodeSchema } from './enums.js'
import { postgresUuidSchema } from './postgresUuid.js'

const uuidSchema = lazySchema(() =>
  z.pipe(
    postgresUuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)

export const combatPerceptionChannelDtoSchema = lazySchema(() =>
  z.enum(['VISUAL', 'AUDITORY', 'VIBRATION', 'NONVISUAL'])
)
export const combatPerceptionAccessGradeDtoSchema = lazySchema(() =>
  z.enum(['DETECTED', 'LOCATED', 'PRECISE'])
)
export const combatPerceptionRequirementDtoSchema = lazySchema(() =>
  z.enum(['DETECT', 'LOCATE', 'PRECISE', 'SEE'])
)
export const combatPerceptionIlluminationDtoSchema = lazySchema(() =>
  z.enum(['BRIGHT', 'DIM', 'ORDINARY_DARKNESS', 'MAGICAL_DARKNESS'])
)
export const combatPerceptionObscurementDtoSchema = lazySchema(() =>
  z.enum(['NONE', 'LIGHT', 'HEAVY'])
)
export const combatPerceptionIlluminationAccessDtoSchema = lazySchema(() =>
  z.enum(['BRIGHT_ONLY', 'DIM', 'ORDINARY_DARKNESS', 'MAGICAL_DARKNESS', 'IGNORE'])
)
export const combatPerceptionObscurementAccessDtoSchema = lazySchema(() =>
  z.enum(['NONE', 'LIGHT', 'HEAVY', 'IGNORE'])
)
export const combatPerceptionPhysicalConstraintDtoSchema = lazySchema(() =>
  z.enum(['LINE_OF_EFFECT', 'SHARED_SURFACE'])
)

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isCanonicalOrder(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value)
}

function canonicalStringArray<T extends z.ZodMiniType<string>>(
  item: T,
  maximum: number,
  message: string
) {
  return z
    .array(item)
    .check(z.maxLength(maximum))
    .check(
      z.superRefine((values, context) => {
        if (!uniqueValues(values))
          context.addIssue({ code: 'custom', message: `${message} must be unique.` })
        if (!isCanonicalOrder(values))
          context.addIssue({ code: 'custom', message: `${message} must be sorted.` })
      })
    )
}

export const combatPerceptionCapabilityDtoSchema = lazySchema(() =>
  z
    .strictObject({
      channel: combatPerceptionChannelDtoSchema,
      accessGrade: combatPerceptionAccessGradeDtoSchema,
      satisfies: z
        .array(combatPerceptionRequirementDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(4))
        .check(z.refine(uniqueValues, 'Perception capability requirements must be unique.')),
      illuminationAccess: combatPerceptionIlluminationAccessDtoSchema,
      obscurementAccess: combatPerceptionObscurementAccessDtoSchema,
      perceivesInvisible: z.boolean(),
      physicalConstraints: z
        .array(combatPerceptionPhysicalConstraintDtoSchema)
        .check(z.maxLength(2))
        .check(z.refine(uniqueValues, 'Perception capability physical constraints must be unique.'))
    })
    .check(
      z.superRefine((capability, context) => {
        const requiresLocated = capability.satisfies.includes('LOCATE')
        const requiresPrecise =
          capability.satisfies.includes('PRECISE') || capability.satisfies.includes('SEE')

        if (requiresLocated && capability.accessGrade === 'DETECTED') {
          context.addIssue({
            code: 'custom',
            path: ['accessGrade'],
            message: 'LOCATE requires a LOCATED or PRECISE capability.'
          })
        }
        if (requiresPrecise && capability.accessGrade !== 'PRECISE') {
          context.addIssue({
            code: 'custom',
            path: ['accessGrade'],
            message: 'PRECISE and SEE require a PRECISE capability.'
          })
        }
      })
    )
)

/** UUID-backed semantic definition; range belongs to the grant or actor source. */
export const senseReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('SENSE'),
    id: uuidSchema,
    gameSystemId: uuidSchema,
    capabilities: z
      .array(combatPerceptionCapabilityDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(8))
  })
)

const contributionIdentitySchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    order: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999))
  })
)

const contributionMeasurementSchema = lazySchema(() =>
  z.strictObject({
    amount: authoredLengthAmountSchema,
    unit: lengthUnitCodeSchema
  })
)

const pinnedSenseContributionFields = lazySchemaParts(() => ({
  senseDefinitionId: uuidSchema,
  definitionVersion: z.number().check(z.int()).check(z.positive()),
  definitionContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
  definitionChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  document: senseReusableDefinitionDocumentDtoSchema
}))

const senseGrantContributionDtoSchema = lazySchema(() =>
  z
    .extend(contributionIdentitySchema, {
      kind: z.literal('SENSE_GRANT'),
      ...pinnedSenseContributionFields(),
      range: z.union([
        z.strictObject({ rangeKind: z.literal('UNLIMITED') }),
        z.extend(contributionMeasurementSchema, { rangeKind: z.literal('DISTANCE') })
      ])
    })
    .check(
      z.superRefine((contribution, context) => {
        if (contribution.document.id !== contribution.senseDefinitionId)
          context.addIssue({
            code: 'custom',
            path: ['document', 'id'],
            message: 'Sense grant document identity must match its pinned sense definition.'
          })
        if (checksumRuleDocument(contribution.document) !== contribution.definitionChecksum)
          context.addIssue({
            code: 'custom',
            path: ['definitionChecksum'],
            message: 'Sense grant checksum must match its pinned sense definition document.'
          })
      })
    )
)

const senseSuppressContributionDtoSchema = lazySchema(() =>
  z
    .extend(contributionIdentitySchema, {
      kind: z.literal('SENSE_SUPPRESS'),
      senseDefinitionIds: canonicalStringArray(
        uuidSchema,
        32,
        'Suppressed sense definition identities'
      ),
      channels: canonicalStringArray(combatPerceptionChannelDtoSchema, 4, 'Suppressed channels')
    })
    .check(
      z.superRefine((contribution, context) => {
        if (contribution.senseDefinitionIds.length === 0 && contribution.channels.length === 0)
          context.addIssue({
            code: 'custom',
            message: 'Sense suppression requires a sense definition or channel.'
          })
      })
    )
)

const accessLimitContributionDtoSchema = lazySchema(() =>
  z
    .extend(contributionIdentitySchema, {
      kind: z.literal('ACCESS_LIMIT'),
      channels: canonicalStringArray(combatPerceptionChannelDtoSchema, 4, 'Limited channels').check(
        z.minLength(1)
      ),
      maximumAccessGrade: z.nullable(combatPerceptionAccessGradeDtoSchema),
      maximumIlluminationAccess: z.nullable(combatPerceptionIlluminationAccessDtoSchema),
      maximumObscurementAccess: z.nullable(combatPerceptionObscurementAccessDtoSchema),
      perceivesInvisible: z.nullable(z.literal(false))
    })
    .check(
      z.superRefine((contribution, context) => {
        if (
          contribution.maximumAccessGrade === null &&
          contribution.maximumIlluminationAccess === null &&
          contribution.maximumObscurementAccess === null &&
          contribution.perceivesInvisible === null
        )
          context.addIssue({
            code: 'custom',
            message: 'Access limits require at least one limit.'
          })
      })
    )
)

const emissionSuppressContributionDtoSchema = lazySchema(() =>
  z.extend(contributionIdentitySchema, {
    kind: z.literal('EMISSION_SUPPRESS'),
    channels: canonicalStringArray(
      combatPerceptionChannelDtoSchema,
      4,
      'Suppressed emission channels'
    ).check(z.minLength(1)),
    bypass: z.enum(['NONE', 'INVISIBILITY'])
  })
)

const illuminationEffectContributionDtoSchema = lazySchema(() =>
  z
    .extend(contributionIdentitySchema, {
      kind: z.literal('ILLUMINATION_EFFECT'),
      illumination: z.nullable(combatPerceptionIlluminationDtoSchema),
      obscurement: z.nullable(combatPerceptionObscurementDtoSchema),
      precedence: z.number().check(z.int()).check(z.gte(-10_000)).check(z.lte(10_000))
    })
    .check(
      z.superRefine((contribution, context) => {
        if (contribution.illumination === null && contribution.obscurement === null)
          context.addIssue({
            code: 'custom',
            message: 'Illumination effects require illumination or obscurement.'
          })
      })
    )
)

export const combatPerceptionContributionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    senseGrantContributionDtoSchema,
    senseSuppressContributionDtoSchema,
    accessLimitContributionDtoSchema,
    emissionSuppressContributionDtoSchema,
    illuminationEffectContributionDtoSchema
  ])
)

export const combatPerceptionContributionsDtoSchema = lazySchema(() =>
  z
    .array(combatPerceptionContributionDtoSchema)
    .check(z.maxLength(32))
    .check(
      z.superRefine((contributions, context) => {
        const ids = contributions.map((contribution) => contribution.id)
        if (!uniqueValues(ids))
          context.addIssue({
            code: 'custom',
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
            code: 'custom',
            message: 'Perception contributions must be ordered by order then identity.'
          })
      })
    )
)

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
