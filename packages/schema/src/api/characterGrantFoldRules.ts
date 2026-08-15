import { z } from 'zod'

export const CHARACTER_GRANT_FOLD_MODEL_KEY = 'character-grant-fold'

const identitySchema = z.string().trim().min(1).max(240)
const codeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/)
const boundedJsonSchema = z
  .json()
  .refine((value) => JSON.stringify(value).length <= 8_192, 'Mechanic facts are too large.')

export const characterMechanicSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('AUTHORED'),
    sourceKind: z.enum([
      'ANCESTRY',
      'BACKGROUND',
      'CLASS',
      'FEAT',
      'FEATURE',
      'OPTION',
      'RACE',
      'SPELL',
      'SUBRACE',
      'SUBCLASS'
    ]),
    definitionId: identitySchema,
    sourceInstanceId: identitySchema
  }),
  z.strictObject({
    kind: z.literal('EQUIPMENT_INSTANCE'),
    equipmentId: identitySchema,
    itemInstanceId: identitySchema
  }),
  z.strictObject({ kind: z.literal('SYSTEM'), systemId: identitySchema }),
  z.strictObject({
    kind: z.literal('COMPANION_INSTANCE'),
    creatureId: identitySchema,
    companionInstanceId: identitySchema
  }),
  z.strictObject({ kind: z.literal('MANUAL_ADJUSTMENT'), adjustmentId: identitySchema })
])

const restrictionConditionSchema = z.strictObject({
  conditionId: identitySchema,
  constraint: z.enum(['INCLUDE', 'EXCLUDE']),
  kind: z.enum([
    'ABILITY_SCORE',
    'HERITAGE',
    'CHARACTER_LEVEL',
    'CLASS_LEVEL',
    'FEAT_OBTAINED',
    'FEATURE_OBTAINED',
    'OPTION_OBTAINED',
    'SPELL_OBTAINED',
    'CAN_CAST_SPELL',
    'PROFICIENCY',
    'EQUIPMENT_EQUIPPED',
    'SOURCE_STATE',
    'UNAVAILABLE',
    'UNSUPPORTED'
  ]),
  mode: z.enum(['ALL', 'SELECTED']).nullable(),
  abilityId: identitySchema.nullable(),
  classIds: z.array(identitySchema).max(20),
  requiredIds: z.array(identitySchema).max(200),
  secondaryRequiredIds: z.array(identitySchema).max(200),
  min: z.number().finite().nullable(),
  max: z.number().finite().nullable(),
  proficiencyKind: codeSchema.nullable(),
  minimumRank: z.enum(['HALF', 'FULL', 'DOUBLE']).nullable(),
  category: codeSchema.nullable(),
  requiredProperties: z.array(codeSchema).max(100),
  sourceState: z.enum(['CARRIED', 'EQUIPPED', 'ATTUNED']).nullable()
})

export const characterGrantFoldRestrictionSchema = z
  .array(
    z.strictObject({
      conditions: z.array(restrictionConditionSchema).max(100)
    })
  )
  .max(50)

const proficiencyOperationSchema = z
  .strictObject({
    grantId: identitySchema,
    proficiencyKind: codeSchema,
    targetIds: z.array(identitySchema).max(200),
    matchIds: z.array(identitySchema).max(200),
    category: codeSchema.nullable(),
    scaling: z.enum(['HALF', 'FULL', 'DOUBLE'])
  })
  .refine(
    ({ targetIds, matchIds }) => targetIds.length === matchIds.length,
    'Proficiency targets and match identities must align.'
  )

const scalingTargetsSchema = z.strictObject({
  level: z.number().int().min(1).max(20),
  targetIds: z.array(identitySchema).max(200)
})

const scalingOperationSchema = z.strictObject({
  grantId: identitySchema,
  scalingKind: z.enum(['NONE', 'PER_LEVEL']),
  targetIds: z.array(identitySchema).max(200),
  levels: z.array(scalingTargetsSchema).max(20)
})

const senseOperationSchema = scalingOperationSchema.extend({
  grantId: identitySchema,
  range: boundedJsonSchema.nullable()
})

const modifierOperationSchema = z.strictObject({
  grantId: identitySchema,
  valueDomainCode: codeSchema,
  modifierKind: codeSchema,
  domain: boundedJsonSchema,
  grant: boundedJsonSchema,
  restrictions: characterGrantFoldRestrictionSchema,
  scopeSpellIds: z.array(identitySchema).max(500)
})

export const characterGrantFoldSourceSchema = z.strictObject({
  sourceId: identitySchema,
  mechanicSource: characterMechanicSourceSchema,
  sourceState: z
    .strictObject({ carried: z.boolean(), equipped: z.boolean(), attuned: z.boolean() })
    .nullable(),
  restrictions: characterGrantFoldRestrictionSchema,
  proficiencies: z.array(proficiencyOperationSchema).max(200),
  senses: z.array(senseOperationSchema).max(200),
  modifiers: z.array(modifierOperationSchema).max(200),
  feats: z.array(scalingOperationSchema).max(200),
  spells: z.array(scalingOperationSchema).max(200)
})

const classSourceSchema = z.strictObject({
  classId: identitySchema,
  level: z.number().int().min(1).max(20),
  base: z
    .strictObject({
      category: z.enum(['BASE', 'SUBCLASS']),
      source: characterGrantFoldSourceSchema,
      multiclassProficiencies: z.array(proficiencyOperationSchema).max(200)
    })
    .nullable(),
  subclass: z
    .strictObject({
      category: z.enum(['BASE', 'SUBCLASS']),
      parentClassId: identitySchema.nullable(),
      source: characterGrantFoldSourceSchema
    })
    .nullable()
})

const featureSourceSchema = z.strictObject({
  sourceKind: z.enum([
    'ANCESTRY',
    'BACKGROUND',
    'CLASS',
    'FEAT',
    'FEATURE',
    'OPTION',
    'RACE',
    'SUBRACE',
    'SUBCLASS',
    'MANUAL'
  ]),
  sourceClassLevel: z.number().int().min(1).max(20).nullable(),
  timingLevel: z.number().int().min(1).max(20).nullable(),
  definition: characterGrantFoldSourceSchema.nullable(),
  selectedOptions: z.array(characterGrantFoldSourceSchema).max(100),
  featDefinition: characterGrantFoldSourceSchema.nullable()
})

const equipmentItemSchema = z.strictObject({
  instanceId: identitySchema,
  equipmentId: identitySchema,
  requiresAttunement: z.boolean(),
  equipped: z.boolean(),
  attuned: z.boolean(),
  restrictions: characterGrantFoldRestrictionSchema,
  rootSourceId: identitySchema,
  rootModifiers: z.array(modifierOperationSchema).max(200),
  chargeId: identitySchema.nullable(),
  features: z
    .array(
      z.strictObject({
        source: characterGrantFoldSourceSchema,
        sourceChargeUse: z
          .strictObject({
            featureId: identitySchema,
            limitKind: codeSchema,
            cost: z.number().finite()
          })
          .nullable()
      })
    )
    .max(100)
})

export const characterGrantFoldInputSchema = z
  .strictObject({
    contractVersion: z.literal(1),
    base: z.strictObject({
      systemId: identitySchema,
      totalLevel: z.number().int().min(0).max(20),
      raceId: identitySchema.nullable(),
      subraceId: identitySchema.nullable(),
      abilities: z.record(identitySchema, z.number().finite()),
      heritageIds: z.array(identitySchema).max(200),
      featureIds: z.array(identitySchema).max(500),
      optionIds: z.array(identitySchema).max(500),
      featIds: z.array(identitySchema).max(500),
      classes: z
        .array(
          z.strictObject({
            classId: identitySchema,
            level: z.number().int().min(1).max(20),
            spellcasting: z.boolean()
          })
        )
        .max(20),
      equipment: z
        .array(
          z.strictObject({
            equipmentId: identitySchema,
            category: codeSchema.nullable(),
            properties: z.array(codeSchema).max(100),
            equipped: z.boolean(),
            attuned: z.boolean()
          })
        )
        .max(500)
    }),
    upstreamSpellIds: z.array(identitySchema).max(5000),
    classes: z.array(classSourceSchema).max(20),
    background: characterGrantFoldSourceSchema.nullable(),
    features: z.array(featureSourceSchema).max(500),
    equipmentItems: z.array(equipmentItemSchema).max(500)
  })
  .refine((value) => JSON.stringify(value).length <= 240_000, 'Grant-fold facts are too large.')

const proficiencyResultSchema = z.strictObject({
  acceptedProficiencyIndex: z.number().int().min(0).max(9_999),
  kind: codeSchema,
  subjectId: identitySchema,
  matchId: identitySchema,
  category: codeSchema.optional(),
  scaling: z.enum(['HALF', 'FULL', 'DOUBLE']),
  source: characterMechanicSourceSchema,
  grantId: identitySchema
})

const senseResultSchema = z.strictObject({
  senseCode: identitySchema,
  range: boundedJsonSchema.optional(),
  acceptedSenseIndex: z.number().int().min(0).max(9_999),
  grantId: identitySchema,
  source: characterMechanicSourceSchema
})

const modifierResultSchema = z.strictObject({
  domainKey: identitySchema,
  modifierKind: codeSchema,
  grant: boundedJsonSchema,
  source: characterMechanicSourceSchema,
  scopeSpellIds: z.array(identitySchema).max(500).optional()
})

const equipmentChargeUseSchema = z.strictObject({
  featureId: identitySchema,
  equipmentId: identitySchema,
  itemInstanceId: identitySchema,
  chargeId: identitySchema,
  cost: z.number().finite()
})

export const characterGrantFoldOutputSchema = z
  .strictObject({
    proficiencies: z.array(proficiencyResultSchema).max(10_000),
    senses: z.array(senseResultSchema).max(10_000),
    modifiers: z.array(modifierResultSchema).max(10_000),
    unlockedFeatIds: z.array(identitySchema).max(10_000),
    unlockedSpellIds: z.array(identitySchema).max(10_000),
    activeSourceIds: z.array(identitySchema).max(10_000),
    activeEquipmentInstanceIds: z.array(identitySchema).max(500),
    equipmentFeatureChargeUses: z.array(equipmentChargeUseSchema).max(10_000),
    modifierGroups: z
      .array(
        z.strictObject({
          domainKey: identitySchema,
          valueDomainCode: codeSchema,
          modifierKind: codeSchema,
          contributions: z
            .array(
              z.strictObject({
                acceptedModifierIndex: z.number().int().min(0).max(9_999),
                sourceId: identitySchema,
                grantId: identitySchema,
                grant: boundedJsonSchema
              })
            )
            .max(10_000)
        })
      )
      .max(10_000)
  })
  .refine((value) => JSON.stringify(value).length <= 240_000, 'Grant-fold result is too large.')

export type CharacterGrantFoldInput = z.infer<typeof characterGrantFoldInputSchema>
export type CharacterGrantFoldOutput = z.infer<typeof characterGrantFoldOutputSchema>
export type CharacterGrantFoldRestriction = z.infer<typeof characterGrantFoldRestrictionSchema>
export type CharacterGrantFoldSource = z.infer<typeof characterGrantFoldSourceSchema>
