import { z, lazySchema } from '../zod.js'

import { staticGrantBaseDtoSchema, staticGrantSelectionDtoSchema } from './grant.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import {
  authoringModeKindSchema,
  proficiencyKindSchema,
  roundingCodeSchema,
  scalingKindSchema,
  scalingAmountKindSchema
} from '../shared/enums.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const proficiencyScalingDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      level: z.literal(scalingAmountKindSchema._zod.def.entries.HALF),
      rounding: roundingCodeSchema
    }),
    z.object({
      level: z.enum([
        scalingAmountKindSchema._zod.def.entries.DOUBLE,
        scalingAmountKindSchema._zod.def.entries.FULL
      ])
    })
  ])
)

const allTargetDtoSchema = lazySchema(() =>
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.ALL)
  })
)

const skillTargetDtoSchema = lazySchema(() =>
  z.union([
    allTargetDtoSchema,
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      skillIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)

const saveAbilityTargetDtoSchema = lazySchema(() =>
  z.union([
    allTargetDtoSchema,
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      abilities: authoredReferenceCollectionSchema(systemCoreCodeSchema)
    })
  ])
)

const languageTargetDtoSchema = lazySchema(() =>
  z.union([
    allTargetDtoSchema,
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      languageIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)

const equipmentTargetDtoSchema = lazySchema(() =>
  z.union([
    z.extend(allTargetDtoSchema, {
      category: z.optional(authoredIdentifierSchema),
      properties: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema))
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema),
      category: z.optional(authoredIdentifierSchema),
      properties: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema))
    })
  ])
)

const equipmentPropertyTargetDtoSchema = lazySchema(() =>
  z.union([
    z.extend(allTargetDtoSchema, {
      category: z.optional(authoredIdentifierSchema)
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      properties: authoredReferenceCollectionSchema(authoredShortTextSchema),
      category: z.optional(authoredIdentifierSchema)
    })
  ])
)

export const proficiencyGrantDtoSchema = lazySchema(() =>
  z.intersection(
    z.intersection(
      z.intersection(
        z.extend(staticGrantBaseDtoSchema, {
          grantKind: z.literal('PROFICIENCY_GRANT'),
          scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE)
        }),
        staticGrantSelectionDtoSchema
      ),
      z.union([
        z.intersection(
          z.object({
            proficiencyKind: z.literal(proficiencyKindSchema._zod.def.entries.SKILL)
          }),
          skillTargetDtoSchema
        ),
        z.intersection(
          z.object({
            proficiencyKind: z.literal(proficiencyKindSchema._zod.def.entries.SAVE_ABILITY)
          }),
          saveAbilityTargetDtoSchema
        ),
        z.intersection(
          z.object({
            proficiencyKind: z.literal(proficiencyKindSchema._zod.def.entries.LANGUAGE)
          }),
          languageTargetDtoSchema
        ),
        z.intersection(
          z.object({
            proficiencyKind: z.literal(proficiencyKindSchema._zod.def.entries.EQUIPMENT)
          }),
          equipmentTargetDtoSchema
        ),
        z.intersection(
          z.object({
            proficiencyKind: z.literal(proficiencyKindSchema._zod.def.entries.EQUIPMENT_PROPERTY)
          }),
          equipmentPropertyTargetDtoSchema
        )
      ])
    ),
    proficiencyScalingDtoSchema
  )
)

export type ProficiencyGrantDto = z.infer<typeof proficiencyGrantDtoSchema>
