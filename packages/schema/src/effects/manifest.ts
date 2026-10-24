import { z, lazySchema } from '../zod.js'
import { manifestNestedBehaviorDtoSchema } from './effect.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { summonStatBlockDtoSchema } from './summonStatBlock.js'
import {
  abilityCodeSchema,
  lengthUnitCodeSchema,
  manifestBlockingRuleSchema,
  manifestRequiredSightSchema,
  sizeCodeSchema
} from '../shared/enums.js'
import {
  authoredIdentifierSchema,
  authoredLengthAmountSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema,
  authoredPositiveLengthAmountSchema,
  authoredReferenceCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

/**
 * One form the caster may give the chosen creatures (Giant Insect: centipedes, spiders, wasps or a
 * scorpion): the Creature they become and how many the option allows.
 */
const manifestCreatureFormDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    label: authoredShortTextSchema,
    creatureId: authoredIdentifierSchema,
    maxTargets: z.number().check(z.int()).check(z.positive())
  })
)

/**
 * The rule a caster-chosen Creature must meet to be a form (Polymorph: a beast whose challenge rating
 * does not exceed the target's), checked at cast against the System creature corpus.
 */
const manifestCreatureFormFilterDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    creatureTypeId: z.optional(authoredIdentifierSchema),
    challengeRatingCapKind: z.enum(['TARGET', 'FIXED']),
    maxChallengeRatingId: z.optional(authoredIdentifierSchema),
    excludedSpeedIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema))
  })
)

/**
 * A continuous bonus a zone gives the creatures standing in it (D155: Aura of Protection): added to
 * every saving throw of an occupant its disposition filter matches, while the zone is unsuppressed. A
 * source ability modifier is resolved against the zone's source when it is placed, then pinned.
 */
const manifestOccupantSaveBonusDtoSchema = lazySchema(() => {
  const shared = {
    id: authoredIdentifierSchema,
    domain: z.literal('EVERY_SAVING_THROW'),
    dispositionFilter: z.literal('ALLIES_AND_SOURCE')
  }
  return z.union([
    z.object({
      ...shared,
      amountKind: z.literal('FIXED'),
      amount: z.number().check(z.int()).check(z.positive())
    }),
    z.object({
      ...shared,
      amountKind: z.literal('SOURCE_ABILITY_MODIFIER'),
      ability: abilityCodeSchema,
      minimum: z.optional(z.number().check(z.int()))
    })
  ])
})

const manifestDestructionCriterionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('DAMAGE_THRESHOLD'),
      damageTypeId: authoredIdentifierSchema,
      amount: authoredNonnegativeNumberSchema
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('STRONG_WIND')
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('WIND_SPEED'),
      minimumMilesPerHour: z.number().check(z.positive()),
      afterRounds: z.number().check(z.int()).check(z.positive())
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('SPELL_CAPABILITY'),
      capability: z.enum([
        'OPEN_PORTAL_ON_SOLID_SURFACE',
        'SHED_BRIGHT_LIGHT',
        'END_SPELL_OR_MAGICAL_EFFECT'
      ]),
      minimumSpellLevel: authoredNonnegativeNumberSchema.check(z.int()).check(z.lte(9)),
      exampleSpellIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema))
    }),
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      kind: z.literal('NAMED_OBJECT'),
      objectLabel: authoredShortTextSchema
    })
  ])
)

const manifestLightDtoSchema = lazySchema(() =>
  z.object({
    bright: z.object({
      amount: authoredLengthAmountSchema,
      unit: lengthUnitCodeSchema
    }),
    dimAdditional: z.object({
      amount: authoredLengthAmountSchema,
      unit: lengthUnitCodeSchema
    })
  })
)

const manifestProximityRuleDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    events: authoredReferenceCollectionSchema(z.enum(['MOVE_WITHIN', 'START_TURN'])).check(
      z.minLength(1)
    ),
    distance: z.object({
      amount: authoredLengthAmountSchema,
      unit: lengthUnitCodeSchema
    }),
    requiresSight: z.boolean(),
    behavior: z.lazy(() => manifestNestedBehaviorDtoSchema)
  })
)

export const manifestDtoSchema: z.ZodMiniType = lazySchema(() =>
  z.lazy(() => {
    const manifestInteractionKindSchema = z.enum([
      'ENTER_OR_PASS_THROUGH',
      'MOVE_ACROSS',
      'ENTER_SPACE',
      'LEAVE_SPACE',
      'START_TURN_IN_SPACE',
      'END_TURN_IN_SPACE',
      'START_OF_SOURCE_TURN',
      'MELEE_HIT_ON_SOURCE',
      'SOURCE_HIT',
      'TARGET_TAKES_FIRE_DAMAGE',
      'START_OF_ATTACHED_TARGET_TURN',
      'END_OF_ATTACHED_TARGET_NEXT_TURN'
    ])
    const attachmentKindSchema = z.enum([
      'SOURCE',
      'PRIMARY_TARGET',
      'PLACED_SPACE',
      'TOUCHED_OBJECT'
    ])
    const baseSchema = z.object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('MANIFEST'),
      label: z.optional(authoredShortTextSchema),
      shape: z.optional(shapeDtoSchema),
      attachmentKind: z.optional(attachmentKindSchema),
      maxApplicationsPerTurn: z.optional(z.number().check(z.int()).check(z.positive())),
      placementSurfaceKind: z.optional(z.literal('LEVEL')),
      applicationTargetKind: z.optional(z.enum(['WEAPON', 'AMMUNITION'])),
      applicationCount: z.optional(z.number().check(z.int()).check(z.positive())),
      qualifyingDamageTypeIds: z.optional(
        authoredReferenceCollectionSchema(authoredIdentifierSchema)
      )
    })

    // SENSOR/WEAPON/OBJECT/ILLUSION; ZONE extends it with a required attachmentKind.
    const plainManifestSchema = z.extend(baseSchema, {
      manifestKind: z.enum(['SENSOR', 'WEAPON', 'OBJECT', 'ILLUSION']),
      behaviors: z.optional(authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema)),
      components: z.optional(
        authoredNestedCollectionSchema(
          z.object({
            id: authoredIdentifierSchema,
            order: z.number().check(z.int()),
            label: authoredShortTextSchema,
            region: z.optional(
              z.object({
                kind: z.literal('SIDE_BAND'),
                distance: z.object({
                  amount: authoredPositiveLengthAmountSchema,
                  unit: lengthUnitCodeSchema
                })
              })
            ),
            interactionKinds: z.optional(
              authoredReferenceCollectionSchema(manifestInteractionKindSchema)
            ),
            bypassAtHalfSpeed: z.optional(z.boolean()),
            choosesUnaffected: z.optional(z.boolean()),
            movementCostMultiplier: z.optional(z.number().check(z.positive())),
            perDistanceMoved: z.optional(
              z.object({ amount: authoredPositiveLengthAmountSchema, unit: lengthUnitCodeSchema })
            ),
            requiresFullyWithin: z.optional(z.boolean()),
            requiredSight: z.optional(
              authoredReferenceCollectionSchema(manifestRequiredSightSchema)
            ),
            automaticSaveSuccessImmunityDamageTypeId: z.optional(authoredIdentifierSchema),
            occupantSaveBonus: z.optional(manifestOccupantSaveBonusDtoSchema),

            requiresIgnition: z.optional(z.boolean()),
            maxApplicationsPerTurn: z.optional(z.number().check(z.int()).check(z.positive())),
            maxApplicationsTotal: z.optional(z.number().check(z.int()).check(z.positive())),
            armorClass: z.optional(authoredNonnegativeNumberSchema),
            hitPoints: z.optional(authoredNonnegativeNumberSchema),
            behaviors: z.optional(authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema)),
            blockingRules: z.optional(
              authoredReferenceCollectionSchema(manifestBlockingRuleSchema)
            ),
            destructionCriteria: z.optional(
              authoredNestedCollectionSchema(manifestDestructionCriterionDtoSchema)
            ),
            releaseCriteria: z.optional(
              authoredNestedCollectionSchema(manifestDestructionCriterionDtoSchema)
            )
          })
        )
      ),
      componentsMustResolveInOrder: z.optional(z.boolean()),
      destructionMustResolveInOrder: z.optional(z.boolean()),
      destroyedComponentsRemainDestroyed: z.optional(z.boolean()),
      placementMustBeUnoccupied: z.optional(z.boolean()),
      invalidPlacementConsumesInvocation: z.optional(z.boolean()),
      designatedCreatureImmunity: z.optional(z.boolean()),
      maximumTargetSize: z.optional(sizeCodeSchema),
      excludesFormlessTargets: z.optional(z.boolean()),
      proximityRule: z.optional(manifestProximityRuleDtoSchema),
      light: z.optional(manifestLightDtoSchema),
      hollow: z.optional(z.boolean()),
      wallThickness: z.optional(
        z.object({
          amount: authoredPositiveLengthAmountSchema,
          unit: lengthUnitCodeSchema
        })
      ),
      spreadsAroundCorners: z.optional(z.boolean()),
      obscurementKind: z.optional(z.enum(['LIGHT', 'HEAVY'])),
      properties: z.optional(
        authoredReferenceCollectionSchema(
          z.enum([
            'NO_HEAT',
            'NO_OXYGEN_USE',
            'CANNOT_BE_SMOTHERED',
            'CANNOT_BE_QUENCHED',
            'CAN_BE_COVERED_OR_HIDDEN'
          ])
        )
      ),
      destructionCriteria: z.optional(
        authoredNestedCollectionSchema(manifestDestructionCriterionDtoSchema)
      ),
      suppressionImmunities: z.optional(
        authoredReferenceCollectionSchema(z.literal('ANTIMAGIC_FIELD'))
      )
    })

    return z.discriminatedUnion('manifestKind', [
      z.extend(baseSchema, {
        manifestKind: z.literal('CREATURE'),
        forms: z.optional(authoredNestedCollectionSchema(manifestCreatureFormDtoSchema)),
        formFilter: z.optional(manifestCreatureFormFilterDtoSchema),
        excessDamageCarriesOver: z.optional(z.boolean())
      }),
      z.extend(baseSchema, {
        manifestKind: z.literal('SUMMON'),
        statBlock: z.optional(summonStatBlockDtoSchema),
        behaviors: z.optional(authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema))
      }),
      plainManifestSchema,
      z.extend(plainManifestSchema, {
        manifestKind: z.literal('ZONE'),
        attachmentKind: attachmentKindSchema
      })
    ])
  })
)

export type ManifestDto = z.infer<typeof manifestDtoSchema>
