import { z, lazySchema } from '../zod.js'
import { createBreakpointScalingDtoSchema } from '../shared/scaling.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'

/** Whether a single-target action may aim at its own user: freely, with a warning, or never. */
export const targetingSelfDtoSchema = lazySchema(() => z.enum(['ALLOWED', 'WARN', 'REFUSED']))

/** The most requirements one single-target action carries. */
const MAX_TARGET_REQUIREMENTS = 4

/**
 * What a creature must be, to the user, to be named as the one target (Encounter only); the commit
 * refuses any other. `HAS_CONDITION` needs one of `conditionIds` held, from the user (`ACTOR`) or from
 * any source (`ANY`). `SIGHT` needs the user to see the target, or the target to see the user.
 * `AT_ZERO_HIT_POINTS` needs a target at 0 hit points that is not dead.
 */
export const targetRequirementDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('HAS_CONDITION'),
      conditionIds: authoredReferenceCollectionSchema(authoredIdentifierSchema),
      source: z.enum(['ACTOR', 'ANY'])
    }),
    z.strictObject({
      kind: z.literal('SIGHT'),
      direction: z.enum(['ACTOR_SEES_TARGET', 'TARGET_SEES_ACTOR'])
    }),
    z.strictObject({ kind: z.literal('AT_ZERO_HIT_POINTS') })
  ])
)

export type TargetRequirementDto = z.infer<typeof targetRequirementDtoSchema>

export const targetingDtoSchema = lazySchema(() =>
  z.discriminatedUnion('selectionKind', [
    z.object({
      selectionKind: z.literal('SELF')
    }),
    z.object({
      selectionKind: z.literal('SINGLE_TARGET'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      self: z.optional(targetingSelfDtoSchema),
      /** The largest target, in size steps above the actor's; a larger one only warns (D152). */
      sizeLimit: z.optional(
        z.object({ stepsAboveActor: z.number().check(z.int()).check(z.nonnegative()) })
      ),
      /** The target must be a creature the actor holds through a relationship it sources (Grappled); any other is refused. */
      heldBySource: z.optional(z.literal(true)),
      targetRequirements: z.optional(
        z
          .array(targetRequirementDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(MAX_TARGET_REQUIREMENTS))
      ),
      allowedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    }),
    z.object({
      selectionKind: z.literal('CHOSEN_CREATURES'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      maxTargets: z.optional(z.number().check(z.int()).check(z.positive())),
      maxTargetsScaling: z.optional(
        createBreakpointScalingDtoSchema(
          z.object({
            amount: z.number().check(z.int()).check(z.positive())
          })
        )
      ),
      allowRepeatedTargets: z.optional(z.boolean()),
      allowedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    }),
    z.object({
      selectionKind: z.literal('AREA_CONTENTS'),
      dispositionKind: z.optional(z.enum(['ANY', 'WILLING', 'HOSTILE'])),
      hitPointPool: z.optional(z.object({ diceConfig: authoredIdentifierSchema })),
      hitPointPoolScaling: z.optional(
        createBreakpointScalingDtoSchema(z.object({ diceConfig: authoredIdentifierSchema }))
      ),
      hitPointPoolIgnoredConditionIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      allowedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      ),
      excludedCreatureTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    })
  ])
)

export type TargetingDto = z.infer<typeof targetingDtoSchema>
