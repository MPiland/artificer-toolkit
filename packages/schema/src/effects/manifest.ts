import { z } from 'zod'
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
    order: z.number().int(),
    kind: z.literal('DAMAGE_THRESHOLD'),
    damageTypeId: authoredIdentifierSchema,
    amount: authoredNonnegativeNumberSchema
  }),
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
    kind: z.literal('STRONG_WIND')
  }),
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
    kind: z.literal('WIND_SPEED'),
    minimumMilesPerHour: z.number().positive(),
    afterRounds: z.number().int().positive()
  }),
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
    kind: z.literal('SPELL_CAPABILITY'),
    capability: z.enum([
      'OPEN_PORTAL_ON_SOLID_SURFACE',
      'SHED_BRIGHT_LIGHT',
      'END_SPELL_OR_MAGICAL_EFFECT'
    ]),
    minimumSpellLevel: authoredNonnegativeNumberSchema.int().max(9),
    exampleSpellIds: authoredReferenceCollectionSchema(authoredIdentifierSchema).optional()
  }),
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
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
  events: authoredReferenceCollectionSchema(z.enum(['MOVE_WITHIN', 'START_TURN'])).min(1),
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
  STRENGTH: numericExprSchema.optional(),
  DEXTERITY: numericExprSchema.optional(),
  CONSTITUTION: numericExprSchema.optional(),
  INTELLIGENCE: numericExprSchema.optional(),
  WISDOM: numericExprSchema.optional(),
  CHARISMA: numericExprSchema.optional()
})

const summonStatBlockDtoSchema = z.object({
  size: authoredIdentifierSchema.optional(),
  armorClass: numericExprSchema.optional(),
  armorClassNote: authoredPlainTextSchema.optional(),
  hitPoints: numericExprSchema.optional(),
  speeds: authoredNestedCollectionSchema(speedDtoSchema).optional(),
  abilityScores: summonAbilityScoresDtoSchema.optional(),
  senses: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  passivePerception: numericExprSchema.optional(),
  damageVulnerabilities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageResistances: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  conditionImmunities: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  damageabilityKind: z.enum(['NORMAL', 'INVULNERABLE', 'SPECIAL']).optional(),
  visibilityKind: z.enum(['VISIBLE', 'INVISIBLE', 'SPECIAL']).optional(),
  occupiesSpace: z.boolean().optional()
})

export const manifestDtoSchema: z.ZodTypeAny = z.lazy(() => {
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
    label: authoredShortTextSchema.optional(),
    shape: shapeDtoSchema.optional(),
    attachmentKind: z
      .enum(['SOURCE', 'PRIMARY_TARGET', 'PLACED_SPACE', 'TOUCHED_OBJECT'])
      .optional(),
    maxApplicationsPerTurn: z.number().int().positive().optional(),
    placementSurfaceKind: z.literal('LEVEL').optional(),
    applicationTargetKind: z.enum(['WEAPON', 'AMMUNITION']).optional(),
    applicationCount: z.number().int().positive().optional(),
    qualifyingDamageTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema).optional()
  })

  return z.discriminatedUnion('manifestKind', [
    baseSchema.extend({
      manifestKind: z.literal('CREATURE'),
      creatureId: authoredIdentifierSchema.optional()
    }),
    baseSchema.extend({
      manifestKind: z.literal('SUMMON'),
      statBlock: summonStatBlockDtoSchema.optional(),
      behaviors: authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema).optional()
    }),
    baseSchema.extend({
      manifestKind: z.enum(['ZONE', 'SENSOR', 'WEAPON', 'OBJECT', 'ILLUSION']),
      behaviors: authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema).optional(),
      components: authoredNestedCollectionSchema(
        z.object({
          id: authoredIdentifierSchema,
          order: z.number().int(),
          label: authoredShortTextSchema,
          interactionKind: manifestInteractionKindSchema.optional(),
          interactionKinds: authoredReferenceCollectionSchema(
            manifestInteractionKindSchema
          ).optional(),
          bypassAtHalfSpeed: z.boolean().optional(),
          movementCostMultiplier: z.number().positive().optional(),
          requiresFullyWithin: z.boolean().optional(),
          automaticSaveSuccessConditions: authoredReferenceCollectionSchema(
            z.enum(['DOES_NOT_BREATHE', 'POISON_IMMUNE'])
          ).optional(),
          requiresIgnition: z.boolean().optional(),
          maxApplicationsPerTurn: z.number().int().positive().optional(),
          maxApplicationsTotal: z.number().int().positive().optional(),
          armorClass: authoredNonnegativeNumberSchema.optional(),
          hitPoints: authoredNonnegativeNumberSchema.optional(),
          behaviors: authoredNestedCollectionSchema(manifestNestedBehaviorDtoSchema).optional(),
          blockingRules: authoredReferenceCollectionSchema(
            z.enum([
              'NONMAGICAL_RANGED_ATTACKS',
              'MAGICAL_RANGED_ATTACKS',
              'SPELLS',
              'THREE_QUARTERS_COVER'
            ])
          ).optional(),
          destructionCriteria: authoredNestedCollectionSchema(
            manifestDestructionCriterionDtoSchema
          ).optional(),
          releaseCriteria: authoredNestedCollectionSchema(
            manifestDestructionCriterionDtoSchema
          ).optional()
        })
      ).optional(),
      componentsMustResolveInOrder: z.boolean().optional(),
      destructionMustResolveInOrder: z.boolean().optional(),
      destroyedComponentsRemainDestroyed: z.boolean().optional(),
      placementMustBeUnoccupied: z.boolean().optional(),
      invalidPlacementConsumesInvocation: z.boolean().optional(),
      designatedCreatureImmunity: z.boolean().optional(),
      maximumTargetSize: sizeCodeSchema.optional(),
      excludesFormlessTargets: z.boolean().optional(),
      proximityRule: manifestProximityRuleDtoSchema.optional(),
      light: manifestLightDtoSchema.optional(),
      hollow: z.boolean().optional(),
      wallThickness: z
        .object({
          amount: z.number().positive(),
          unit: measurementUnitCodeSchema
        })
        .optional(),
      spreadsAroundCorners: z.boolean().optional(),
      obscurementKind: z.enum(['LIGHT', 'HEAVY']).optional(),
      properties: authoredReferenceCollectionSchema(
        z.enum([
          'NO_HEAT',
          'NO_OXYGEN_USE',
          'CANNOT_BE_SMOTHERED',
          'CANNOT_BE_QUENCHED',
          'CAN_BE_COVERED_OR_HIDDEN'
        ])
      ).optional(),
      destructionCriteria: authoredNestedCollectionSchema(
        manifestDestructionCriterionDtoSchema
      ).optional(),
      suppressionImmunities: authoredReferenceCollectionSchema(
        z.literal('ANTIMAGIC_FIELD')
      ).optional()
    })
  ])
})

export type ManifestDto = z.infer<typeof manifestDtoSchema>
