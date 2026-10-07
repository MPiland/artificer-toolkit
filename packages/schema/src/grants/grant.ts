import { z, lazySchema } from '../zod.js'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'
import { facetDtoSchema } from '../shared/facet.js'
import {
  authoringModeKindSchema,
  authoringSelectionDuplicatePolicySchema,
  authoringSelectionKindSchema,
  scalingKindSchema
} from '../shared/enums.js'

/** A GRANTED grant (or level) carries no selection policy; stating one is refused rather than stripped. */
const grantedPolicyFieldsDtoSchema = lazySchema(() =>
  z.object({
    count: z.optional(z.undefined()),
    selectionDuplicatePolicy: z.optional(z.undefined())
  })
)

/** A CHOSEN grant (or level) states how many to pick and whether repeats are allowed. */
const chosenPolicyFieldsDtoSchema = lazySchema(() =>
  z.object({
    count: z.number().check(z.int()),
    selectionDuplicatePolicy: authoringSelectionDuplicatePolicySchema
  })
)

const grantedSelectionDtoSchema = lazySchema(() =>
  z.extend(grantedPolicyFieldsDtoSchema, {
    selectionKind: z.literal(authoringSelectionKindSchema._zod.def.entries.GRANTED)
  })
)

const chosenSelectionDtoSchema = lazySchema(() =>
  z.extend(chosenPolicyFieldsDtoSchema, {
    selectionKind: z.literal(authoringSelectionKindSchema._zod.def.entries.CHOSEN)
  })
)

/** The selection rule of a grant that never scales, discriminated as the shared `GrantScalingNone`. */
export const staticGrantSelectionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('selectionKind', [grantedSelectionDtoSchema, chosenSelectionDtoSchema])
)

export const staticGrantBaseDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    restrictions: z.optional(facetDtoSchema)
  })
)

export const grantPayloadDtoSchema = lazySchema(() =>
  z.discriminatedUnion('authoringModeKind', [
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.ALL)
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED)
    })
  ])
)

export const grantProgressionLevelDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    level: z.number().check(z.int()),
    order: z.number().check(z.int())
  })
)

function createGrantProgressionFieldsDtoSchema<
  TPolicy extends z.ZodMiniType,
  TPayload extends z.ZodMiniType
>(levelPolicySchema: TPolicy, levelPayloadSchema: TPayload) {
  const levelSchema = z.intersection(
    z.intersection(grantProgressionLevelDtoSchema, levelPolicySchema),
    levelPayloadSchema
  )

  return z.object({
    progression: z.discriminatedUnion('scalingSource', [
      z.object({
        scalingSource: z.literal('CHARACTER_LEVEL'),
        levels: authoredNestedCollectionSchema(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('CLASS_LEVEL'),
        classId: authoredIdentifierSchema,
        levels: authoredNestedCollectionSchema(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('PARENT_CLASS_LEVEL'),
        levels: authoredNestedCollectionSchema(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('SPELL_CAST_LEVEL'),
        levels: authoredNestedCollectionSchema(levelSchema)
      })
    ])
  })
}

/** A PER_LEVEL grant states its target on every progression level only; a top-level target is refused, not stripped. */
const perLevelNoTargetDtoSchema = lazySchema(() =>
  z.object({ authoringModeKind: z.optional(z.undefined()) })
)

/**
 * The target, selection and scaling rule of a grant whose `targetSchema` may scale per level,
 * mirroring the shared `GrantScalingNone` / `GrantScalingPerLevel`: a NONE grant states its target
 * (and, when CHOSEN, its policy) on itself; a PER_LEVEL grant states them only on each progression level.
 */
export function createScalingGrantDtoSchema<TTarget extends z.ZodMiniType>(targetSchema: TTarget) {
  const scalingKind = scalingKindSchema._zod.def.entries
  return z.union([
    z.intersection(
      z.discriminatedUnion('selectionKind', [
        z.extend(grantedSelectionDtoSchema, { scalingKind: z.literal(scalingKind.NONE) }),
        z.extend(chosenSelectionDtoSchema, { scalingKind: z.literal(scalingKind.NONE) })
      ]),
      targetSchema
    ),
    z.intersection(
      z.discriminatedUnion('selectionKind', [
        z.extend(
          z.extend(grantedSelectionDtoSchema, { scalingKind: z.literal(scalingKind.PER_LEVEL) }),
          createGrantProgressionFieldsDtoSchema(grantedPolicyFieldsDtoSchema, targetSchema).shape
        ),
        z.extend(
          z.extend(grantedPolicyFieldsDtoSchema, {
            selectionKind: z.literal(authoringSelectionKindSchema._zod.def.entries.CHOSEN),
            scalingKind: z.literal(scalingKind.PER_LEVEL)
          }),
          createGrantProgressionFieldsDtoSchema(chosenPolicyFieldsDtoSchema, targetSchema).shape
        )
      ]),
      perLevelNoTargetDtoSchema
    )
  ])
}
