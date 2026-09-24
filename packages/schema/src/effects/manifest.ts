import { z } from '../zod.js'
import { manifestNestedBehaviorDtoSchema } from './effect.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { numericExprSchema } from '../shared/numericExpr.js'
import { measurementUnitCodeSchema, sizeCodeSchema } from '../shared/enums.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

const manifestDestructionCriterionDtoSchema = z.discriminatedUnion('kind', [
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

const manifestLightDtoSchema = z.object({
  bright: z.object({
    amount: authoredNonnegativeNumberSchema,
    unit: measurementUnitCodeSchema
  }),
  dimAdditional: z.object({
    amount: authoredNonnegativeNumberSchema,
    unit: measurementUnitCodeSchema
  })
})

const manifestProximityRuleDtoSchema = z.object({
  id: authoredIdentifierSchema,
  events: authoredReferenceCollectionSchema(z.enum(['MOVE_WITHIN', 'START_TURN'])).check(
    z.minLength(1)
  ),
  distance: z.object({
    amount: authoredNonnegativeNumberSchema,
    unit: measurementUnitCodeSchema
  }),
  requiresSight: z.boolean(),
  behavior: z.lazy(() => manifestNestedBehaviorDtoSchema)
})

const speedDtoSchema = z.object({
  speedId: authoredIdentifierSchema,
  amount: z.number(),
  unit: measurementUnitCodeSchema
})

const summonAbilityScoresDtoSchema = z.object({
  STRENGTH: z.optional(numericExprSchema),
  DEXTERITY: z.optional(numericExprSchema),
  CONSTITUTION: z.optional(numericExprSchema),
  INTELLIGENCE: z.optional(numericExprSchema),
  WISDOM: z.optional(numericExprSchema),
  CHARISMA: z.optional(numericExprSchema)
})

const summonStatBlockDtoSchema = z.object({
  size: z.optional(authoredIdentifierSchema),
  armorClass: z.optional(numericExprSchema),
  armorClassNote: z.optional(authoredPlainTextSchema),
  hitPoints: z.optional(numericExprSchema),
  speeds: z.optional(authoredNestedCollectionSchema(speedDtoSchema)),
  abilityScores: z.optional(summonAbilityScoresDtoSchema),
  senses: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  passivePerception: z.optional(numericExprSchema),
  damageVulnerabilities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  damageResistances: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  damageImmunities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  conditionImmunities: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
  damageabilityKind: z.optional(z.enum(['NORMAL', 'INVULNERABLE', 'SPECIAL'])),
  visibilityKind: z.optional(z.enum(['VISIBLE', 'INVISIBLE', 'SPECIAL'])),
  occupiesSpace: z.optional(z.boolean())
})

export const manifestDtoSchema: z.ZodMiniType = z.lazy(() => {
  const manifestInteractionKindSchema = z.enum([
    'ENTER_OR_PASS_THROUGH',
    'MOVE_ACROSS',
    'ENTER_SPACE',
    'START_TURN_IN_SPACE',
    'END_TURN_IN_SPACE',
    'SOURCE_HIT',
    'TARGET_TAKES_FIRE_DAMAGE',
    'START_OF_ATTACHED_TARGET_TURN',
    'END_OF_ATTACHED_TARGET_NEXT_TURN'
  ])
  const baseSchema = z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('MANIFEST'),
    label: z.optional(authoredShortTextSchema),
    shape: z.optional(shapeDtoSchema),
    attachmentKind: z.optional(
      z.enum(['SOURCE', 'PRIMARY_TARGET', 'PLACED_SPACE', 'TOUCHED_OBJECT'])
    ),
    maxApplicationsPerTurn: z.optional(z.number().check(z.int()).check(z.positive())),
    placementSurfaceKind: z.optional(z.literal('LEVEL')),
    applicationTargetKind: z.optional(z.enum(['WEAPON', 'AMMUNITION'])),
    applicationCount: z.optional(z.number().check(z.int()).check(z.positive())),
    qualifyingDamageTypeIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema))
  })

  return z.discriminatedUnion('manifestKind', [
    z.extend(baseSchema, {
      manifestKind: z.literal('CREATURE'),
      creatureId: z.optional(authoredIdentifierSchema)
    }),
    z.extend(baseSchema, {
      manifestKind: z.literal('SUMMON'),
      statBlock: z.optional(summonStatBlockDtoSchema),
      behaviors: z.optional(authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema))
    }),
    z.extend(baseSchema, {
      manifestKind: z.enum(['ZONE', 'SENSOR', 'WEAPON', 'OBJECT', 'ILLUSION']),
      behaviors: z.optional(authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema)),
      components: z.optional(
        authoredNestedCollectionSchema(
          z.object({
            id: authoredIdentifierSchema,
            order: z.number().check(z.int()),
            label: authoredShortTextSchema,
            interactionKind: z.optional(manifestInteractionKindSchema),
            interactionKinds: z.optional(
              authoredReferenceCollectionSchema(manifestInteractionKindSchema)
            ),
            bypassAtHalfSpeed: z.optional(z.boolean()),
            movementCostMultiplier: z.optional(z.number().check(z.positive())),
            requiresFullyWithin: z.optional(z.boolean()),
            automaticSaveSuccessConditions: z.optional(
              authoredReferenceCollectionSchema(z.enum(['DOES_NOT_BREATHE', 'POISON_IMMUNE']))
            ),
            requiresIgnition: z.optional(z.boolean()),
            maxApplicationsPerTurn: z.optional(z.number().check(z.int()).check(z.positive())),
            maxApplicationsTotal: z.optional(z.number().check(z.int()).check(z.positive())),
            armorClass: z.optional(authoredNonnegativeNumberSchema),
            hitPoints: z.optional(authoredNonnegativeNumberSchema),
            behaviors: z.optional(authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema)),
            blockingRules: z.optional(
              authoredReferenceCollectionSchema(
                z.enum([
                  'NONMAGICAL_RANGED_ATTACKS',
                  'MAGICAL_RANGED_ATTACKS',
                  'SPELLS',
                  'THREE_QUARTERS_COVER'
                ])
              )
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
          amount: z.number().check(z.positive()),
          unit: measurementUnitCodeSchema
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
  ])
})

export type ManifestDto = z.infer<typeof manifestDtoSchema>
