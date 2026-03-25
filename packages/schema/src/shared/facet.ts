import { z } from 'zod'

import {
  abilityCodeSchema,
  authoringConstraintCodeSchema,
  authoringModeKindSchema,
  chargeLimitKindSchema,
  chargeResetKindSchema,
  durationKindSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema,
  measurementUnitCodeSchema,
  nodeSubjectCodeSchema,
  predicateCodeSchema,
  proficiencyKindSchema,
  rangeKindSchema,
  relationCodeSchema,
  scalingAmountKindSchema
} from './enums.js'

export const unknownObjectSchema = z.record(z.string(), z.unknown())
export const unknownObjectArraySchema = z.array(unknownObjectSchema)

const selectableRootSchema = z.object({
  authoringModeKind: authoringModeKindSchema.optional()
})

const subjectSelectionSchema = selectableRootSchema.extend({
  classIds: z.array(z.string()).optional(),
  featureIds: z.array(z.string()).optional(),
  spellIds: z.array(z.string()).optional(),
  equipmentIds: z.array(z.string()).optional(),
  featIds: z.array(z.string()).optional(),
  raceIds: z.array(z.string()).optional(),
  backgroundIds: z.array(z.string()).optional(),
  optionIds: z.array(z.string()).optional(),
  subraceIds: z.array(z.string()).optional(),
  subclassIds: z.array(z.string()).optional(),
  resourceIds: z.array(z.string()).optional(),
  ancestryOptionIds: z.array(z.string()).optional(),
  proficiencyKind: proficiencyKindSchema.optional()
})

const selectableSchema = (
  selectedSchema: z.ZodObject<z.ZodRawShape>,
  extraSchema?: z.ZodObject<z.ZodRawShape>
) => z.union([
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }).merge(extraSchema ?? z.object({})),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED)
  }).merge(selectedSchema).merge(extraSchema ?? z.object({}))
])

const rangePredicatePayloadSchema = z.union([
  selectableSchema(z.object({
    rangeKind: z.array(z.enum([
      rangeKindSchema.enum.SELF,
      rangeKindSchema.enum.TOUCH,
      rangeKindSchema.enum.SIGHT,
      rangeKindSchema.enum.UNLIMITED
    ]))
  })),
  selectableSchema(z.object({
    rangeKind: z.array(z.literal(rangeKindSchema.enum.DISTANCE))
  }), z.object({
    min: z.number(),
    max: z.number().optional(),
    unit: measurementUnitCodeSchema
  }))
])

const durationPredicatePayloadSchema = z.union([
  selectableSchema(z.object({
    durationKind: z.array(z.literal(durationKindSchema.enum.INSTANTANEOUS))
  })),
  selectableSchema(z.object({
    durationKind: z.array(z.enum([
      durationKindSchema.enum.TURN,
      durationKindSchema.enum.ROUND,
      durationKindSchema.enum.MINUTE,
      durationKindSchema.enum.HOUR,
      durationKindSchema.enum.DAY,
      durationKindSchema.enum.WEEK,
      durationKindSchema.enum.MONTH,
      durationKindSchema.enum.YEAR
    ]))
  }), z.object({
    min: z.number(),
    max: z.number().optional()
  }))
])

const predicatePayloadSchema = z.union([
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SUBCLASS_SPECIALIZATION)
  }).and(selectableSchema(z.object({
    specializationIds: z.array(z.string())
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SPELLCASTING)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.RANGE)
  }).and(rangePredicatePayloadSchema),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.DURATION)
  }).and(durationPredicatePayloadSchema),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.CONCENTRATION)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.RITUAL)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SIZE)
  }).and(selectableSchema(z.object({
    sizes: z.array(z.string())
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.FEATURE_OBTAINED),
    featureIds: z.array(z.string())
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.OPTION_OBTAINED),
    featureIds: z.array(z.string()).optional(),
    optionIds: z.array(z.string())
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.MAGIC_SCHOOL)
  }).and(selectableSchema(z.object({
    magicSchoolIds: z.array(z.string())
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SPELLCASTING_ABILITY)
  }).and(selectableSchema(z.object({
    abilities: z.array(abilityCodeSchema)
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SPELL_LEVEL),
    min: z.number(),
    max: z.number().optional()
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SAVING_THROW_ABILITY)
  }).and(selectableSchema(z.object({
    abilities: z.array(abilityCodeSchema)
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SAVING_THROW_DC),
    min: z.number(),
    max: z.number().optional()
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.EQUIPMENT_CATEGORY),
    category: equipmentCategoryCodeSchema
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.EQUIPMENT_PROPERTY)
  }).and(selectableSchema(z.object({
    properties: z.array(equipmentPropertyCodeSchema)
  }), z.object({
    category: equipmentCategoryCodeSchema.optional()
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.EQUIPMENT_PROFICIENCY)
  }).and(selectableSchema(z.object({
    equipmentIds: z.array(z.string())
  }), z.object({
    category: equipmentCategoryCodeSchema.optional(),
    properties: z.array(equipmentPropertyCodeSchema).optional(),
    level: scalingAmountKindSchema
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.EQUIPMENT_PROPERTY_PROFICIENCY)
  }).and(selectableSchema(z.object({
    properties: z.array(equipmentPropertyCodeSchema)
  }), z.object({
    category: equipmentCategoryCodeSchema.optional()
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SAVE_ABILITY_PROFICIENCY)
  }).and(selectableSchema(z.object({
    abilities: abilityCodeSchema
  }), z.object({
    level: scalingAmountKindSchema
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.LANGUAGE_PROFICIENCY)
  }).and(selectableSchema(z.object({
    languageIds: z.array(z.string())
  }), z.object({
    level: scalingAmountKindSchema
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.EQUIPMENT_EQUIPPED)
  }).and(selectableSchema(z.object({
    equipmentIds: z.array(z.string())
  }), z.object({
    category: equipmentCategoryCodeSchema.optional(),
    properties: z.array(equipmentPropertyCodeSchema).optional()
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.ARMOR_CLASS),
    min: z.number(),
    max: z.number().optional()
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.DAMAGE_TYPE)
  }).and(selectableSchema(z.object({
    damageTypeIds: z.array(z.string())
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.CONDITION_TYPE)
  }).and(selectableSchema(z.object({
    conditionTypeIds: z.array(z.string())
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.CHARGE_LIMIT_KIND)
  }).and(selectableSchema(z.object({
    chargeLimitKind: z.array(chargeLimitKindSchema)
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.CHARGE_RESET_KIND)
  }).and(selectableSchema(z.object({
    chargeResetKind: z.array(chargeResetKindSchema)
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.CAN_CAST_SPELL)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.CHARACTER_LEVEL),
    min: z.number(),
    max: z.number().optional()
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.CLASS_LEVEL),
    min: z.number(),
    max: z.number().optional()
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SPELL_OBTAINED),
    spellIds: z.array(z.string())
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.FEAT_OBTAINED),
    featIds: z.array(z.string())
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SKILL_PROFICIENCY)
  }).and(selectableSchema(z.object({
    skillIds: z.array(z.string())
  }), z.object({
    level: scalingAmountKindSchema
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SKILL_SCORE)
  }).and(selectableSchema(z.object({
    skillIds: z.array(z.string())
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.ABILITY_SCORE)
  }).and(selectableSchema(z.object({
    abilities: abilityCodeSchema
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.SAVING_THROW_ABILITY_BONUS)
  }).and(selectableSchema(z.object({
    abilities: abilityCodeSchema
  }), z.object({
    min: z.number(),
    max: z.number().optional()
  }))),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.WHILE_SOURCE_CARRIED)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.WHILE_SOURCE_EQUIPPED)
  }),
  z.object({
    predicateCode: z.literal(predicateCodeSchema.enum.WHILE_SOURCE_ATTUNED)
  })
])

const facetBodySchema: z.ZodTypeAny = z.lazy(() => subjectSelectionSchema.extend({
  groups: z.array(facetBodyGroupSchema)
}))

const facetPredicateConditionSchema = z.object({
  id: z.string(),
  order: z.number(),
  kind: z.literal('PREDICATE'),
  constraint: authoringConstraintCodeSchema
}).and(predicatePayloadSchema)

const facetExistsConditionSchema: z.ZodTypeAny = z.lazy(() => z.object({
  id: z.string(),
  order: z.number(),
  kind: z.literal('EXISTS'),
  constraint: authoringConstraintCodeSchema,
  relationCode: relationCodeSchema,
  where: facetBodySchema.optional()
}).and(subjectSelectionSchema))

const facetConditionSchema: z.ZodTypeAny = z.union([
  facetPredicateConditionSchema,
  facetExistsConditionSchema
])

const facetBodyGroupSchema: z.ZodTypeAny = z.object({
  id: z.string(),
  order: z.number(),
  conditions: z.array(facetConditionSchema)
})

const facetContextSchema: z.ZodTypeAny = z.object({
  id: z.string(),
  order: z.number(),
  subject: nodeSubjectCodeSchema,
  conditions: z.array(facetConditionSchema)
}).and(subjectSelectionSchema.partial({
  authoringModeKind: true
}))

const facetGroupSchema: z.ZodTypeAny = z.object({
  id: z.string(),
  order: z.number(),
  contexts: z.array(facetContextSchema)
})

/**
 * Facet schemas stay intentionally recursive because they model authored rule
 * targeting, not a UI-only filter helper. We validate the correlated predicate
 * payloads that drive SRD rules today, while still keeping the recursive
 * structure generic enough for later homebrew extensions.
 */
export const facetDtoSchema = z.object({
  id: z.string(),
  groups: z.array(facetGroupSchema)
})

export const scopedFacetDtoSchema = z.object({
  id: z.string(),
  subject: nodeSubjectCodeSchema
}).and(facetBodySchema)

export type FacetDto = z.infer<typeof facetDtoSchema>
export type ScopedFacetDto = z.infer<typeof scopedFacetDtoSchema>
