import { getPredicateOptionsForSubject, RELATIONS } from '@artificer-toolkit/shared/core'
import { z } from '../zod.js'

import {
  abilityCodeSchema,
  authoringConstraintCodeSchema,
  authoringModeKindSchema,
  chargeLimitKindSchema,
  chargeResetKindSchema,
  creatureCategoryCodeSchema,
  durationKindSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema,
  measurementUnitCodeSchema,
  nodeSubjectCodeSchema,
  predicateCodeSchema,
  proficiencyKindSchema,
  rangeKindSchema,
  relationCodeSchema,
  scalingAmountKindSchema,
  sizeCodeSchema,
  vehicleCategoryCodeSchema
} from './enums.js'
import {
  AUTHORED_LIMITS,
  authoredIdentifierSchema,
  unknownObjectSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema
} from './authoredLimits.js'

export { unknownObjectSchema }
export const unknownObjectArraySchema = authoredNestedCollectionSchema(unknownObjectSchema)

const selectableRootSchema = z.object({
  authoringModeKind: z.optional(authoringModeKindSchema)
})

const subjectSelectionSchema = z.extend(selectableRootSchema, {
  classIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  featureIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  spellIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  equipmentIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  featIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  raceIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  backgroundIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  creatureIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  vehicleIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  optionIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  subraceIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  subclassIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  resourceIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  ancestryOptionIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
  proficiencyKind: z.optional(proficiencyKindSchema)
})

const selectableSchema = (
  selectedSchema: z.ZodMiniObject<z.core.$ZodShape>,
  extraSchema?: z.ZodMiniObject<z.core.$ZodShape>
) =>
  z.union([
    z.extend(
      z.object({
        authoringModeKind: z.optional(z.literal(authoringModeKindSchema._zod.def.entries.ALL))
      }),
      (extraSchema ?? z.object({})).shape
    ),
    z.extend(
      z.extend(
        z.object({
          authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED)
        }),
        selectedSchema.shape
      ),
      (extraSchema ?? z.object({})).shape
    )
  ])

const rangePredicatePayloadSchema = z.union([
  selectableSchema(
    z.object({
      rangeKind: authoredReferenceCollectionSchema(
        z.enum([
          rangeKindSchema._zod.def.entries.SELF,
          rangeKindSchema._zod.def.entries.TOUCH,
          rangeKindSchema._zod.def.entries.SIGHT,
          rangeKindSchema._zod.def.entries.UNLIMITED
        ])
      )
    })
  ),
  selectableSchema(
    z.object({
      rangeKind: authoredReferenceCollectionSchema(
        z.literal(rangeKindSchema._zod.def.entries.DISTANCE)
      )
    }),
    z.object({
      min: z.number(),
      max: z.optional(z.number()),
      unit: measurementUnitCodeSchema
    })
  )
])

const durationPredicatePayloadSchema = z.union([
  selectableSchema(
    z.object({
      durationKind: authoredReferenceCollectionSchema(
        z.literal(durationKindSchema._zod.def.entries.INSTANTANEOUS)
      )
    })
  ),
  selectableSchema(
    z.object({
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
    }),
    z.object({
      min: z.number(),
      max: z.optional(z.number())
    })
  )
])

const predicatePayloadSchema = z.union([
  // Equipment modifiers commonly use this leaf; avoid trying each deeper predicate first.
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.WHILE_SOURCE_EQUIPPED)
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SUBCLASS_SPECIALIZATION)
    }),
    selectableSchema(
      z.object({
        specializationIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELLCASTING)
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.RANGE)
    }),
    rangePredicatePayloadSchema
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.DURATION)
    }),
    durationPredicatePayloadSchema
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CONCENTRATION)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.RITUAL)
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SIZE)
    }),
    selectableSchema(
      z.object({
        sizes: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.FEATURE_OBTAINED),
    featureIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.OPTION_OBTAINED),
    featureIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
    optionIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.MAGIC_SCHOOL)
    }),
    selectableSchema(
      z.object({
        magicSchoolIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELLCASTING_ABILITY)
    }),
    selectableSchema(
      z.object({
        abilities: authoredReferenceCollectionSchema(abilityCodeSchema)
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELL_LEVEL),
    min: z.number(),
    max: z.optional(z.number())
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVING_THROW_ABILITY)
    }),
    selectableSchema(
      z.object({
        abilities: authoredReferenceCollectionSchema(abilityCodeSchema)
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVING_THROW_DC),
    min: z.number(),
    max: z.optional(z.number())
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_CATEGORY),
    category: equipmentCategoryCodeSchema
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_PROPERTY)
    }),
    selectableSchema(
      z.object({
        properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)
      }),
      z.object({
        category: z.optional(equipmentCategoryCodeSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_PROFICIENCY)
    }),
    selectableSchema(
      z.object({
        equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      z.object({
        category: z.optional(equipmentCategoryCodeSchema),
        properties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)),
        level: scalingAmountKindSchema
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_PROPERTY_PROFICIENCY)
    }),
    selectableSchema(
      z.object({
        properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)
      }),
      z.object({
        category: z.optional(equipmentCategoryCodeSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVE_ABILITY_PROFICIENCY)
    }),
    selectableSchema(
      z.object({
        abilities: abilityCodeSchema
      }),
      z.object({
        level: scalingAmountKindSchema
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.LANGUAGE_PROFICIENCY)
    }),
    selectableSchema(
      z.object({
        languageIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      z.object({
        level: scalingAmountKindSchema
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.EQUIPMENT_EQUIPPED)
    }),
    selectableSchema(
      z.object({
        equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      z.object({
        category: z.optional(equipmentCategoryCodeSchema),
        properties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema))
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ARMOR_CLASS),
    min: z.number(),
    max: z.optional(z.number())
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.DAMAGE_TYPE)
    }),
    selectableSchema(
      z.object({
        damageTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CONDITION_TYPE)
    }),
    selectableSchema(
      z.object({
        conditionTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CHARGE_LIMIT_KIND)
    }),
    selectableSchema(
      z.object({
        chargeLimitKind: authoredReferenceCollectionSchema(chargeLimitKindSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CHARGE_RESET_KIND)
    }),
    selectableSchema(
      z.object({
        chargeResetKind: authoredReferenceCollectionSchema(chargeResetKindSchema)
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CAN_CAST_SPELL)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CHARACTER_LEVEL),
    min: z.number(),
    max: z.optional(z.number())
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CLASS_LEVEL),
    classIds: authoredReferenceCollectionSchema(authoredIdentifierSchema).check(z.minLength(1)),
    min: z.number(),
    max: z.optional(z.number())
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SPELL_OBTAINED),
    spellIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.FEAT_OBTAINED),
    featIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.HERITAGE)
    }),
    selectableSchema(
      z.object({
        heritageIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SKILL_PROFICIENCY)
    }),
    selectableSchema(
      z.object({
        skillIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      }),
      z.object({
        level: scalingAmountKindSchema
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SKILL_SCORE)
    }),
    selectableSchema(
      z.object({
        skillIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.ABILITY_SCORE)
    }),
    selectableSchema(
      z.object({
        abilities: abilityCodeSchema
      }),
      z.object({
        min: z.number(),
        max: z.optional(z.number())
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.SAVING_THROW_ABILITY_BONUS)
    }),
    selectableSchema(
      z.object({
        abilities: abilityCodeSchema
      }),
      z.object({
        min: z.number(),
        max: z.optional(z.number())
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.WHILE_SOURCE_CARRIED)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.WHILE_SOURCE_ATTUNED)
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_CATEGORY)
    }),
    selectableSchema(
      z.object({
        categories: authoredReferenceCollectionSchema(creatureCategoryCodeSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_TYPE)
    }),
    selectableSchema(
      z.object({
        creatureTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_SIZE)
    }),
    selectableSchema(
      z.object({
        sizes: authoredReferenceCollectionSchema(sizeCodeSchema)
      })
    )
  ),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_IS_MOUNT)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema._zod.def.entries.CREATURE_IS_COMPANION)
  }),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.VEHICLE_CATEGORY)
    }),
    selectableSchema(
      z.object({
        categories: authoredReferenceCollectionSchema(vehicleCategoryCodeSchema)
      })
    )
  ),
  z.intersection(
    z.object({
      predicateCode: z.literal(predicateCodeSchema._zod.def.entries.VEHICLE_SIZE)
    }),
    selectableSchema(
      z.object({
        sizes: authoredReferenceCollectionSchema(sizeCodeSchema)
      })
    )
  )
])

type SubjectSelectionDto = z.infer<typeof subjectSelectionSchema>

type FacetPredicateConditionDto = {
  id: string
  order: number
  kind: 'PREDICATE'
  constraint: z.infer<typeof authoringConstraintCodeSchema>
} & z.infer<typeof predicatePayloadSchema>

type FacetExistsConditionDto = {
  id: string
  order: number
  kind: 'EXISTS'
  constraint: z.infer<typeof authoringConstraintCodeSchema>
  relationCode: z.infer<typeof relationCodeSchema>
  where?: FacetBodyDto
} & SubjectSelectionDto

type FacetConditionDto = FacetPredicateConditionDto | FacetExistsConditionDto

type FacetBodyGroupDto = {
  id: string
  order: number
  conditions?: FacetConditionDto[]
}

type FacetBodyDto = SubjectSelectionDto & {
  groups: FacetBodyGroupDto[]
}

type FacetContextDto = SubjectSelectionDto & {
  id: string
  order: number
  subject: z.infer<typeof nodeSubjectCodeSchema>
  conditions?: FacetConditionDto[]
}

type FacetGroupDto = {
  id: string
  order: number
  contexts: FacetContextDto[]
}

export type FacetDto = {
  id: string
  groups: FacetGroupDto[]
}

export type CharacterFacetDto = {
  id: string
  groups: Array<{
    id: string
    order: number
    contexts: Array<Omit<FacetContextDto, 'subject'> & { subject: 'CHARACTER' }>
  }>
}

export type ScopedFacetDto = FacetBodyDto & {
  id: string
  subject: z.infer<typeof nodeSubjectCodeSchema>
}

const facetBodySchema: z.ZodMiniType<FacetBodyDto> = z.lazy(() =>
  z.extend(subjectSelectionSchema, {
    groups: authoredNestedCollectionSchema(facetBodyGroupSchema)
  })
)

const facetPredicateConditionSchema = z.intersection(
  z.object({
    id: authoredIdentifierSchema,
    order: z.number(),
    kind: z.literal('PREDICATE'),
    constraint: authoringConstraintCodeSchema
  }),
  predicatePayloadSchema
)

const facetExistsConditionSchema: z.ZodMiniType<FacetExistsConditionDto> = z.lazy(() =>
  z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      order: z.number(),
      kind: z.literal('EXISTS'),
      constraint: authoringConstraintCodeSchema,
      relationCode: relationCodeSchema,
      where: z.optional(facetBodySchema)
    }),
    subjectSelectionSchema
  )
)

const facetConditionSchema: z.ZodMiniType<FacetConditionDto> = z.union([
  facetPredicateConditionSchema,
  facetExistsConditionSchema
])

const facetBodyGroupSchema: z.ZodMiniType<FacetBodyGroupDto> = z.object({
  id: authoredIdentifierSchema,
  order: z.number(),
  conditions: z.optional(authoredNestedCollectionSchema(facetConditionSchema))
})

const facetContextSchema: z.ZodMiniType<FacetContextDto> = z.intersection(
  z.object({
    id: authoredIdentifierSchema,
    order: z.number(),
    subject: nodeSubjectCodeSchema,
    conditions: z.optional(authoredNestedCollectionSchema(facetConditionSchema))
  }),
  z.partial(subjectSelectionSchema, {
    authoringModeKind: true
  })
)

const facetGroupSchema: z.ZodMiniType<FacetGroupDto> = z.object({
  id: authoredIdentifierSchema,
  order: z.number(),
  contexts: authoredNestedCollectionSchema(facetContextSchema)
})

/**
 * Facet schemas stay intentionally recursive because they model authored rule
 * targeting, not a UI-only filter helper. We validate the correlated predicate
 * payloads that drive SRD rules today, while still keeping the recursive
 * structure generic enough for later homebrew extensions.
 */
const facetDtoSchemaBase = z.object({
  id: authoredIdentifierSchema,
  groups: authoredNestedCollectionSchema(facetGroupSchema)
})

export const facetDtoSchema: z.ZodMiniType<FacetDto> = z.pipe(
  z.transform(rejectExcessiveFacetNesting),
  facetDtoSchemaBase
)

const characterFacetContextSchema: z.ZodMiniType<
  CharacterFacetDto['groups'][number]['contexts'][number]
> = z.intersection(
  z.object({
    id: authoredIdentifierSchema,
    order: z.number(),
    subject: z.literal('CHARACTER'),
    conditions: z.optional(authoredNestedCollectionSchema(facetConditionSchema))
  }),
  z.partial(subjectSelectionSchema, {
    authoringModeKind: true
  })
)

const characterFacetDtoSchemaBase: z.ZodMiniType<CharacterFacetDto> = z
  .object({
    id: authoredIdentifierSchema,
    groups: authoredNestedCollectionSchema(
      z.object({
        id: authoredIdentifierSchema,
        order: z.number(),
        contexts: authoredNestedCollectionSchema(characterFacetContextSchema)
      })
    )
  })
  .check(
    z.superRefine((facet, context) => {
      const predicateCodes = new Set<string>(
        getPredicateOptionsForSubject('CHARACTER').map((option) => option.code)
      )
      const relationCodes = new Set<string>(Object.keys(RELATIONS.CHARACTER))

      facet.groups.forEach((group, groupIndex) => {
        group.contexts.forEach((characterContext, contextIndex) => {
          characterContext.conditions?.forEach((condition, conditionIndex) => {
            if (condition.kind === 'PREDICATE' && !predicateCodes.has(condition.predicateCode)) {
              context.addIssue({
                code: 'custom',
                message: `Predicate "${condition.predicateCode}" is not valid for CHARACTER.`,
                path: [
                  'groups',
                  groupIndex,
                  'contexts',
                  contextIndex,
                  'conditions',
                  conditionIndex,
                  'predicateCode'
                ]
              })
            }

            if (condition.kind === 'EXISTS' && !relationCodes.has(condition.relationCode)) {
              context.addIssue({
                code: 'custom',
                message: `Relation "${condition.relationCode}" is not valid for CHARACTER.`,
                path: [
                  'groups',
                  groupIndex,
                  'contexts',
                  contextIndex,
                  'conditions',
                  conditionIndex,
                  'relationCode'
                ]
              })
            }
          })
        })
      })
    })
  )

export const characterFacetDtoSchema: z.ZodMiniType<CharacterFacetDto> = z.pipe(
  z.transform(rejectExcessiveFacetNesting),
  characterFacetDtoSchemaBase
)

const scopedFacetDtoSchemaBase = z.intersection(
  z.object({ id: authoredIdentifierSchema, subject: nodeSubjectCodeSchema }),
  facetBodySchema
)

export const scopedFacetDtoSchema: z.ZodMiniType<ScopedFacetDto> = z.pipe(
  z.transform(rejectExcessiveFacetNesting),
  scopedFacetDtoSchemaBase
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
