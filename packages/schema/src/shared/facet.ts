import {
  getPredicateOptionsForSubject,
  type NodeSubjectCode,
  type PredicateCode,
  type PredicatePayloadByCode
} from '@artificer-toolkit/shared/core'
import type { FacetBodyAuthored, FacetContextAuthored } from '@artificer-toolkit/shared/authored'
import { z, lazySchema, lazySchemaParts } from '../zod.js'

import {
  abilityCodeSchema,
  activationCodeSchema,
  authoringConstraintCodeSchema,
  authoringModeKindSchema,
  chargeLimitKindSchema,
  chargeResetKindSchema,
  creatureCategoryCodeSchema,
  durationKindSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema,
  lengthUnitCodeSchema,
  predicateCodeSchema,
  proficiencyKindSchema,
  rangeKindSchema,
  scalingAmountKindSchema,
  sizeCodeSchema,
  vehicleCategoryCodeSchema
} from './enums.js'
import {
  AUTHORED_LIMITS,
  authoredIdentifierSchema,
  authoredLengthAmountSchema,
  unknownObjectSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema
} from './authoredLimits.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'

export { unknownObjectSchema }
export const unknownObjectArraySchema = lazySchema(() =>
  authoredNestedCollectionSchema(unknownObjectSchema)
)

type AllMode = { authoringModeKind: z.ZodMiniLiteral<'ALL'> }
type SelectedMode = { authoringModeKind: z.ZodMiniLiteral<'SELECTED'> }
type SelectableSchema<Selected extends z.core.$ZodShape> = z.ZodMiniUnion<
  readonly [
    z.ZodMiniObject<AllMode, z.core.$strip>,
    z.ZodMiniObject<z.core.util.Extend<SelectedMode, Selected>, z.core.$strip>
  ]
>
type SelectableWithSchema<
  Selected extends z.core.$ZodShape,
  Extra extends z.core.$ZodShape
> = z.ZodMiniUnion<
  readonly [
    z.ZodMiniObject<z.core.util.Extend<AllMode, Extra>, z.core.$strip>,
    z.ZodMiniObject<
      z.core.util.Extend<z.core.util.Extend<SelectedMode, Selected>, Extra>,
      z.core.$strip
    >
  ]
>

/** The shared `Selectable`: ALL, or SELECTED with its fields; the mode is always stated. */
function selectableSchema<Selected extends z.core.$ZodShape>(
  selected: Selected
): SelectableSchema<Selected>
function selectableSchema<Selected extends z.core.$ZodShape, Extra extends z.core.$ZodShape>(
  selected: Selected,
  extra: Extra
): SelectableWithSchema<Selected, Extra>
function selectableSchema(selected: z.core.$ZodShape, extra: z.core.$ZodShape = {}) {
  const mode = authoringModeKindSchema._zod.def.entries
  return z.union([
    z.object({ authoringModeKind: z.literal(mode.ALL), ...extra }),
    z.object({ authoringModeKind: z.literal(mode.SELECTED), ...selected, ...extra })
  ])
}
const rangePredicatePayloadSchema = lazySchema(() =>
  z.union([
    selectableSchema({
      rangeKind: authoredReferenceCollectionSchema(
        z.enum([
          rangeKindSchema._zod.def.entries.SELF,
          rangeKindSchema._zod.def.entries.TOUCH,
          rangeKindSchema._zod.def.entries.SIGHT,
          rangeKindSchema._zod.def.entries.UNLIMITED
        ])
      )
    }),
    selectableSchema(
      {
        rangeKind: authoredReferenceCollectionSchema(
          z.literal(rangeKindSchema._zod.def.entries.DISTANCE)
        )
      },
      {
        min: authoredLengthAmountSchema,
        max: z.optional(authoredLengthAmountSchema),
        unit: lengthUnitCodeSchema
      }
    )
  ])
)

const durationPredicatePayloadSchema = lazySchema(() =>
  z.union([
    selectableSchema({
      durationKind: authoredReferenceCollectionSchema(
        z.literal(durationKindSchema._zod.def.entries.INSTANTANEOUS)
      )
    }),
    selectableSchema(
      {
        durationKind: authoredReferenceCollectionSchema(
          z.enum([
            durationKindSchema._zod.def.entries.TURN,
            durationKindSchema._zod.def.entries.ROUND,
            durationKindSchema._zod.def.entries.MINUTE,
            durationKindSchema._zod.def.entries.HOUR,
            durationKindSchema._zod.def.entries.DAY,
            durationKindSchema._zod.def.entries.WEEK,
            durationKindSchema._zod.def.entries.MONTH,
            durationKindSchema._zod.def.entries.YEAR
          ])
        )
      },
      {
        min: z.number(),
        max: z.optional(z.number())
      }
    )
  ])
)

const predicatePayloadSchemas = lazySchemaParts(
  () =>
    ({
      WHILE_SOURCE_EQUIPPED: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.WHILE_SOURCE_EQUIPPED)
      }),
      SUBCLASS_SPECIALIZATION: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SUBCLASS_SPECIALIZATION)
        }),
        selectableSchema({
          specializationIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
        })
      ),
      SPELLCASTING: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELLCASTING)
      }),
      RANGE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.RANGE)
        }),
        rangePredicatePayloadSchema
      ),
      DURATION: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.DURATION)
        }),
        durationPredicatePayloadSchema
      ),
      CONCENTRATION: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CONCENTRATION)
      }),
      RITUAL: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.RITUAL)
      }),
      SIZE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SIZE)
        }),
        selectableSchema({
          sizes: authoredReferenceCollectionSchema(sizeCodeSchema)
        })
      ),
      FEATURE_OBTAINED: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.FEATURE_OBTAINED),
        featureIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      OPTION_OBTAINED: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.OPTION_OBTAINED),
        featureIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
        optionIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      MAGIC_SCHOOL: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.MAGIC_SCHOOL)
        }),
        selectableSchema({
          magicSchoolIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
        })
      ),
      SPELLCASTING_ABILITY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELLCASTING_ABILITY)
        }),
        selectableSchema({
          abilities: authoredReferenceCollectionSchema(abilityCodeSchema)
        })
      ),
      SPELL_LEVEL: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELL_LEVEL),
        min: z.number(),
        max: z.optional(z.number())
      }),
      SAVING_THROW_ABILITY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVING_THROW_ABILITY)
        }),
        selectableSchema({
          abilities: authoredReferenceCollectionSchema(abilityCodeSchema)
        })
      ),
      SAVING_THROW_DC: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVING_THROW_DC),
        min: z.number(),
        max: z.optional(z.number())
      }),
      EQUIPMENT_CATEGORY: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_CATEGORY),
        category: equipmentCategoryCodeSchema
      }),
      EQUIPMENT_PROPERTY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_PROPERTY)
        }),
        selectableSchema(
          {
            properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)
          },
          {
            category: z.optional(equipmentCategoryCodeSchema)
          }
        )
      ),
      SOLE_WIELDED_WEAPON: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SOLE_WIELDED_WEAPON)
      }),
      ATTACK_ABILITY: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ATTACK_ABILITY),
        ability: abilityCodeSchema
      }),
      ATTACK_ACTIVATION: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ATTACK_ACTIVATION),
        activation: activationCodeSchema
      }),
      ATTACK_ROLL_MODE: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ATTACK_ROLL_MODE),
        rollMode: systemCoreCodeSchema,
        /** Met by every roll mode except `rollMode`. */
        negated: z.optional(z.boolean())
      }),
      ENEMY_NEAR_TARGET: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ENEMY_NEAR_TARGET),
        feet: z.number().check(z.positive())
      }),
      TARGET_HAS_NOT_TAKEN_TURN: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.TARGET_HAS_NOT_TAKEN_TURN)
      }),
      MOVED_TOWARD_TARGET: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.MOVED_TOWARD_TARGET),
        minFeet: z.number().check(z.positive())
      }),
      EQUIPMENT_PROFICIENCY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_PROFICIENCY)
        }),
        selectableSchema(
          {
            equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
          },
          {
            category: z.optional(equipmentCategoryCodeSchema),
            properties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)),
            level: scalingAmountKindSchema
          }
        )
      ),
      EQUIPMENT_PROPERTY_PROFICIENCY: z.intersection(
        z.object({
          predicateCode: z.literal(
            predicateCodeSchema._zod.def.entries.EQUIPMENT_PROPERTY_PROFICIENCY
          )
        }),
        selectableSchema(
          {
            properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)
          },
          {
            category: z.optional(equipmentCategoryCodeSchema)
          }
        )
      ),
      SAVE_ABILITY_PROFICIENCY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVE_ABILITY_PROFICIENCY)
        }),
        selectableSchema(
          {
            abilities: abilityCodeSchema
          },
          {
            level: scalingAmountKindSchema
          }
        )
      ),
      LANGUAGE_PROFICIENCY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.LANGUAGE_PROFICIENCY)
        }),
        selectableSchema(
          {
            languageIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
          },
          {
            level: scalingAmountKindSchema
          }
        )
      ),
      EQUIPMENT_EQUIPPED: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_EQUIPPED)
        }),
        selectableSchema(
          {
            equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
          },
          {
            category: z.optional(equipmentCategoryCodeSchema),
            properties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema))
          }
        )
      ),
      ARMOR_CLASS: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ARMOR_CLASS),
        min: z.number(),
        max: z.optional(z.number())
      }),
      DAMAGE_TYPE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.DAMAGE_TYPE)
        }),
        selectableSchema({
          damageTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
        })
      ),
      CONDITION_TYPE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CONDITION_TYPE)
        }),
        selectableSchema({
          conditionTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
        })
      ),
      CHARGE_LIMIT_KIND: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CHARGE_LIMIT_KIND)
        }),
        selectableSchema({
          chargeLimitKind: authoredReferenceCollectionSchema(chargeLimitKindSchema)
        })
      ),
      CHARGE_RESET_KIND: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CHARGE_RESET_KIND)
        }),
        selectableSchema({
          chargeResetKind: authoredReferenceCollectionSchema(chargeResetKindSchema)
        })
      ),
      CAN_CAST_SPELL: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CAN_CAST_SPELL)
      }),
      CAN_ACT: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CAN_ACT)
      }),
      SPEED_ABOVE_ZERO: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPEED_ABOVE_ZERO)
      }),
      FREE_HAND: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.FREE_HAND)
      }),
      TURN_MOVEMENT: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.TURN_MOVEMENT),
        maxFeet: z.optional(z.number()),
        maxSpeedFraction: z.optional(z.number())
      }),
      ATTACK_ACTION_OTHER_WEAPON: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ATTACK_ACTION_OTHER_WEAPON)
        }),
        selectableSchema({
          properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)
        })
      ),
      CHARACTER_LEVEL: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CHARACTER_LEVEL),
        min: z.number(),
        max: z.optional(z.number())
      }),
      CLASS_LEVEL: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CLASS_LEVEL),
        classIds: authoredReferenceCollectionSchema(authoredIdentifierSchema).check(z.minLength(1)),
        min: z.number(),
        max: z.optional(z.number())
      }),
      SPELL_OBTAINED: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELL_OBTAINED),
        spellIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      FEAT_OBTAINED: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.FEAT_OBTAINED),
        featIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      HERITAGE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.HERITAGE)
        }),
        selectableSchema({
          heritageIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
        })
      ),
      SKILL_PROFICIENCY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SKILL_PROFICIENCY)
        }),
        selectableSchema(
          {
            skillIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
          },
          {
            level: scalingAmountKindSchema
          }
        )
      ),
      SKILL_SCORE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SKILL_SCORE)
        }),
        selectableSchema({
          skillIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
        })
      ),
      ABILITY_SCORE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ABILITY_SCORE)
        }),
        selectableSchema(
          {
            abilities: abilityCodeSchema
          },
          {
            min: z.number(),
            max: z.optional(z.number())
          }
        )
      ),
      SAVING_THROW_ABILITY_BONUS: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVING_THROW_ABILITY_BONUS)
        }),
        selectableSchema(
          {
            abilities: abilityCodeSchema
          },
          {
            min: z.number(),
            max: z.optional(z.number())
          }
        )
      ),
      WHILE_SOURCE_CARRIED: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.WHILE_SOURCE_CARRIED)
      }),
      WHILE_SOURCE_ATTUNED: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.WHILE_SOURCE_ATTUNED)
      }),
      CREATURE_CATEGORY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_CATEGORY)
        }),
        selectableSchema({
          categories: authoredReferenceCollectionSchema(creatureCategoryCodeSchema)
        })
      ),
      CREATURE_TYPE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_TYPE)
        }),
        selectableSchema({
          creatureTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
        })
      ),
      CREATURE_SIZE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_SIZE)
        }),
        selectableSchema({
          sizes: authoredReferenceCollectionSchema(sizeCodeSchema)
        })
      ),
      CREATURE_IS_MOUNT: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_IS_MOUNT)
      }),
      CREATURE_IS_COMPANION: z.object({
        predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_IS_COMPANION)
      }),
      VEHICLE_CATEGORY: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.VEHICLE_CATEGORY)
        }),
        selectableSchema({
          categories: authoredReferenceCollectionSchema(vehicleCategoryCodeSchema)
        })
      ),
      VEHICLE_SIZE: z.intersection(
        z.object({
          predicateCode: z.literal(predicateCodeSchema._zod.def.entries.VEHICLE_SIZE)
        }),
        selectableSchema({
          sizes: authoredReferenceCollectionSchema(sizeCodeSchema)
        })
      )
    }) satisfies {
      [C in PredicateCode]: z.ZodMiniType<{ predicateCode: C } & PredicatePayloadByCode[C]>
    }
)

type FacetGroupDto = {
  id: string
  order: number
  contexts: FacetContextAuthored[]
}

export type FacetDto = {
  id: string
  groups: FacetGroupDto[]
}

export type SubjectFacetDto<S extends NodeSubjectCode> = {
  id: string
  groups: Array<{
    id: string
    order: number
    contexts: FacetContextAuthored<S>[]
  }>
}
const subjectSelectionShapes = lazySchemaParts(() => {
  const ids = authoredReferenceCollectionSchema(authoredIdentifierSchema)
  return {
    CLASS: { classIds: ids },
    FEATURE: { featureIds: ids },
    SPELL: { spellIds: ids },
    EQUIPMENT: { equipmentIds: ids },
    FEAT: { featIds: ids },
    RACE: { raceIds: ids },
    BACKGROUND: { backgroundIds: ids },
    CREATURE: { creatureIds: ids },
    VEHICLE: { vehicleIds: ids },
    PROFICIENCY_GRANT: { proficiencyKind: proficiencyKindSchema },
    OPTION: { optionIds: ids },
    SUBRACE: { subraceIds: ids },
    SUBCLASS: { subclassIds: ids },
    RESOURCE: { resourceIds: ids },
    RACE_ANCESTRY_OPTION: { ancestryOptionIds: ids },
    CHARACTER: {}
  } satisfies { [S in NodeSubjectCode]: z.core.$ZodShape }
})

const conditionBaseShape = lazySchemaParts(() => ({
  id: authoredIdentifierSchema,
  order: z.number(),
  constraint: authoringConstraintCodeSchema
}))

/** Predicate conditions are limited to the predicate codes the shared registry allows for `subject`. */
function predicateConditionFor<S extends NodeSubjectCode>(subject: S) {
  const payloads = predicatePayloadSchemas()
  return z.intersection(
    z.object({ ...conditionBaseShape(), kind: z.literal('PREDICATE') }),
    z.union(
      getPredicateOptionsForSubject(subject).map((option) => payloads[option.code]),
      {
        error: (issue) => {
          const input = issue.input
          const code =
            typeof input === 'object' && input !== null && 'predicateCode' in input
              ? input.predicateCode
              : undefined
          const allowed = getPredicateOptionsForSubject(subject).some(
            (option) => option.code === code
          )
          return typeof code === 'string' && !allowed
            ? `Predicate "${code}" is not valid for ${subject}.`
            : undefined
        }
      }
    )
  )
}

/** An EXISTS hop to `target`, whose `where` body and selection are those of the target subject. */
function existsConditionTo<T extends NodeSubjectCode>(target: T) {
  return z.intersection(
    z.object({
      ...conditionBaseShape(),
      kind: z.literal('EXISTS'),
      relationCode: z.literal(target),
      where: z.optional(z.lazy(() => subjectFacetSchemas()[target].body))
    }),
    selectableSchema(subjectSelectionShapes()[target])
  )
}

function facetBodyFor<S extends NodeSubjectCode, C extends z.ZodMiniType>(
  subject: S,
  condition: C
) {
  return z.intersection(
    z.object({
      groups: authoredNestedCollectionSchema(
        z.object({
          id: authoredIdentifierSchema,
          order: z.number(),
          conditions: z.optional(authoredNestedCollectionSchema(condition))
        })
      )
    }),
    selectableSchema(subjectSelectionShapes()[subject])
  )
}

function facetContextBaseShape<S extends NodeSubjectCode, C extends z.ZodMiniType>(
  subject: S,
  condition: C
) {
  return {
    id: authoredIdentifierSchema,
    order: z.number(),
    subject: z.literal(subject),
    conditions: z.optional(authoredNestedCollectionSchema(condition))
  }
}

/** A context states its subject, then ALL of it or SELECTED ids of it; the mode is always explicit. */
function facetContextFor<S extends Exclude<NodeSubjectCode, 'CHARACTER'>, C extends z.ZodMiniType>(
  subject: S,
  condition: C
) {
  const base = facetContextBaseShape(subject, condition)
  const mode = authoringModeKindSchema._zod.def.entries
  return z.union([
    z.object({ ...base, authoringModeKind: z.literal(mode.ALL) }),
    z.object({
      ...base,
      authoringModeKind: z.literal(mode.SELECTED),
      ...subjectSelectionShapes()[subject]
    })
  ])
}

function subjectFacetSchemaFor<
  S extends Exclude<NodeSubjectCode, 'CHARACTER'>,
  C extends z.ZodMiniType
>(subject: S, condition: C) {
  return { body: facetBodyFor(subject, condition), context: facetContextFor(subject, condition) }
}

type SubjectFacetSchemas = {
  [S in NodeSubjectCode]: {
    body: z.ZodMiniType<FacetBodyAuthored<S>>
    context: z.ZodMiniType<FacetContextAuthored<S>>
  }
}

/**
 * The facet schemas of every subject, mirroring the shared `FacetContextAuthored` /
 * `FacetBodyAuthored`: a context's conditions are the predicates of its own subject plus EXISTS hops
 * to the subjects it relates to (`RELATIONS`), and every selection states its authoring mode.
 */
const subjectFacetSchemas = lazySchemaParts((): SubjectFacetSchemas => {
  const characterCondition = z.union([
    predicateConditionFor('CHARACTER'),
    existsConditionTo('CREATURE'),
    existsConditionTo('VEHICLE')
  ])
  return {
    CLASS: subjectFacetSchemaFor(
      'CLASS',
      z.union([
        predicateConditionFor('CLASS'),
        existsConditionTo('FEATURE'),
        existsConditionTo('SUBCLASS'),
        existsConditionTo('RESOURCE'),
        existsConditionTo('PROFICIENCY_GRANT')
      ])
    ),
    SUBCLASS: subjectFacetSchemaFor(
      'SUBCLASS',
      z.union([
        predicateConditionFor('SUBCLASS'),
        existsConditionTo('FEATURE'),
        existsConditionTo('RESOURCE'),
        existsConditionTo('PROFICIENCY_GRANT')
      ])
    ),
    FEATURE: subjectFacetSchemaFor(
      'FEATURE',
      z.union([
        predicateConditionFor('FEATURE'),
        existsConditionTo('OPTION'),
        existsConditionTo('PROFICIENCY_GRANT')
      ])
    ),
    FEAT: subjectFacetSchemaFor(
      'FEAT',
      z.union([
        predicateConditionFor('FEAT'),
        existsConditionTo('FEATURE'),
        existsConditionTo('PROFICIENCY_GRANT')
      ])
    ),
    EQUIPMENT: subjectFacetSchemaFor(
      'EQUIPMENT',
      z.union([predicateConditionFor('EQUIPMENT'), existsConditionTo('FEATURE')])
    ),
    OPTION: subjectFacetSchemaFor(
      'OPTION',
      z.union([predicateConditionFor('OPTION'), existsConditionTo('PROFICIENCY_GRANT')])
    ),
    BACKGROUND: subjectFacetSchemaFor(
      'BACKGROUND',
      z.union([
        predicateConditionFor('BACKGROUND'),
        existsConditionTo('FEATURE'),
        existsConditionTo('PROFICIENCY_GRANT')
      ])
    ),
    RACE: subjectFacetSchemaFor(
      'RACE',
      z.union([
        predicateConditionFor('RACE'),
        existsConditionTo('FEATURE'),
        existsConditionTo('SUBRACE'),
        existsConditionTo('RACE_ANCESTRY_OPTION')
      ])
    ),
    SUBRACE: subjectFacetSchemaFor(
      'SUBRACE',
      z.union([
        predicateConditionFor('SUBRACE'),
        existsConditionTo('FEATURE'),
        existsConditionTo('RACE_ANCESTRY_OPTION')
      ])
    ),
    RACE_ANCESTRY_OPTION: subjectFacetSchemaFor(
      'RACE_ANCESTRY_OPTION',
      z.union([predicateConditionFor('RACE_ANCESTRY_OPTION'), existsConditionTo('FEATURE')])
    ),
    SPELL: subjectFacetSchemaFor('SPELL', predicateConditionFor('SPELL')),
    CREATURE: subjectFacetSchemaFor('CREATURE', predicateConditionFor('CREATURE')),
    VEHICLE: subjectFacetSchemaFor('VEHICLE', predicateConditionFor('VEHICLE')),
    RESOURCE: subjectFacetSchemaFor('RESOURCE', predicateConditionFor('RESOURCE')),
    PROFICIENCY_GRANT: subjectFacetSchemaFor(
      'PROFICIENCY_GRANT',
      predicateConditionFor('PROFICIENCY_GRANT')
    ),
    CHARACTER: {
      body: facetBodyFor('CHARACTER', characterCondition),
      context: z.object(facetContextBaseShape('CHARACTER', characterCondition))
    }
  }
})

const facetContextSchema: z.ZodMiniType<FacetContextAuthored> = lazySchema(() => {
  const schemas = subjectFacetSchemas()
  return z.union(Object.values(schemas).map((subjectSchemas) => subjectSchemas.context))
})

const facetGroupSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number(),
    contexts: authoredNestedCollectionSchema(facetContextSchema)
  })
)

/**
 * A facet is OR-groups of AND-contexts; each context is typed by its subject exactly as the shared
 * `FacetAuthored`. Invariant: a context, an EXISTS hop and every selectable predicate state their
 * `authoringModeKind` (ALL or SELECTED) explicitly, a SELECTED one carries its ids, and conditions
 * are limited to the predicates and relations of the context's subject. Nesting is bounded by
 * `AUTHORED_LIMITS.facetNestingDepth`.
 */
export const facetDtoSchema: z.ZodMiniType<FacetDto> = lazySchema(() =>
  z.pipe(
    z.transform(rejectExcessiveFacetNesting),
    z.object({
      id: authoredIdentifierSchema,
      groups: authoredNestedCollectionSchema(facetGroupSchema)
    })
  )
)

function subjectFacetDtoSchema<S extends NodeSubjectCode>(
  contextSchema: z.ZodMiniType<FacetContextAuthored<S>>
): z.ZodMiniType<SubjectFacetDto<S>> {
  return z.pipe(
    z.transform(rejectExcessiveFacetNesting),
    z.object({
      id: authoredIdentifierSchema,
      groups: authoredNestedCollectionSchema(
        z.object({
          id: authoredIdentifierSchema,
          order: z.number(),
          contexts: authoredNestedCollectionSchema(contextSchema)
        })
      )
    })
  )
}

export const characterFacetDtoSchema: z.ZodMiniType<SubjectFacetDto<'CHARACTER'>> = lazySchema(() =>
  subjectFacetDtoSchema(subjectFacetSchemas().CHARACTER.context)
)

export const spellFacetDtoSchema: z.ZodMiniType<SubjectFacetDto<'SPELL'>> = lazySchema(() =>
  subjectFacetDtoSchema(subjectFacetSchemas().SPELL.context)
)
function rejectExcessiveFacetNesting(value: unknown, context: z.core.ParsePayload): unknown {
  if (!exceedsFacetNestingDepth(value)) return value

  context.issues.push({
    code: 'custom',
    message: `Facet nesting must be at most ${AUTHORED_LIMITS.facetNestingDepth} levels`,
    input: value
  })
  return z.NEVER
}

function exceedsFacetNestingDepth(value: unknown): boolean {
  const pending: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }]
  const seen = new Set<object>()

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || typeof current.value !== 'object' || current.value === null) continue
    if (seen.has(current.value)) return true
    seen.add(current.value)

    if (Array.isArray(current.value)) {
      for (const item of current.value) pending.push({ depth: current.depth, value: item })
      continue
    }

    for (const [key, child] of Object.entries(current.value)) {
      if (child === undefined) continue
      const depth = key === 'where' ? current.depth + 1 : current.depth
      if (depth > AUTHORED_LIMITS.facetNestingDepth) return true
      pending.push({ depth, value: child })
    }
  }

  return false
}
