import { z } from 'zod'

import {
  abilityCodeSchema,
  activationCodeSchema,
  authoredRecordStatusSchema,
  equipmentPropertyCodeSchema,
  sizeCodeSchema,
  spellAttributeSchema,
  spellComponentSchema
} from '../shared/enums.js'
import {
  capacityDtoSchema,
  castingTimeDtoSchema,
  costDtoSchema,
  rangeDtoSchema,
  weightDtoSchema
} from '../subjects/shared.js'
import {
  characterResourceOwnerRefDtoSchema,
  characterResourceRecoveryDtoSchema,
  characterSpellSourceRefDtoSchema
} from './characterSheet.js'
import { characterSheetReferenceFeatureDtoSchema } from './characterBuilder.js'
import { characterActionReasonCodeSchema } from './characterActionRules.js'

export const characterSheetFactDtoSchema = z.object({
  label: z.string(),
  value: z.string()
})

export const characterSheetProficiencyFactDtoSchema = characterSheetFactDtoSchema.extend({
  kind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON'])
})

export const characterSheetOptionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional()
})

export const characterSheetMetaDtoSchema = z.object({
  characterId: z.string(),
  campaignId: z.string().uuid().nullable().optional(),
  viewer: z.enum(['CHARACTER_OWNER', 'CAMPAIGN_OWNER']),
  capabilities: z.object({
    managePlayState: z.boolean(),
    managePrivateNotes: z.boolean(),
    manageInventory: z.boolean(),
    openBuilder: z.boolean()
  }),
  systemId: z.string(),
  status: authoredRecordStatusSchema,
  streamVersion: z.number().int(),
  hasBuilderDraft: z.boolean().optional()
})

export const characterSheetIdentityDtoSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  concept: z.string().optional(),
  classSummary: z.string(),
  raceLabel: z.string().optional(),
  backgroundLabel: z.string().optional(),
  totalLevel: z.number().int()
})

export const characterSheetAbilityDtoSchema = z.object({
  ability: abilityCodeSchema,
  score: z.number().int(),
  modifier: z.number().int(),
  rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])
})

export const characterSheetHitDiceDtoSchema = z.object({
  die: z.number().int(),
  total: z.number().int(),
  used: z.number().int(),
  remaining: z.number().int()
})

export const characterSheetConditionDtoSchema = z.object({
  conditionTypeId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  notes: z.string().optional()
})

export const characterSheetExhaustionDtoSchema = z
  .strictObject({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    level: z.number().int().nonnegative(),
    minimumLevel: z.number().int().nonnegative(),
    maximumLevel: z.number().int().positive(),
    notes: z.string().optional()
  })
  .superRefine((exhaustion, context) => {
    if (
      exhaustion.minimumLevel > exhaustion.maximumLevel ||
      exhaustion.level < exhaustion.minimumLevel ||
      exhaustion.level > exhaustion.maximumLevel
    ) {
      context.addIssue({
        code: 'custom',
        path: ['level'],
        message: 'Exhaustion level must be within the rules-system range.'
      })
    }
  })

export const characterSheetOverviewDtoSchema = z.object({
  abilities: z.array(characterSheetAbilityDtoSchema),
  facts: z.array(characterSheetFactDtoSchema),
  armorClass: z.number().int(),
  initiative: z.number().int(),
  initiativeRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
  proficiencyBonus: z.number().int(),
  inspiration: z.boolean().optional(),
  currentHitPoints: z.number().int(),
  maxHitPoints: z.number().int(),
  tempHitPoints: z.number().int(),
  maxHitPointsModifier: z.number().int(),
  maxHitPointsModifierAdjustmentId: z.guid().nullable(),
  maxHitPointsOverride: z.number().int().nullable(),
  savingThrows: z.array(
    z.object({
      ability: abilityCodeSchema,
      label: z.string(),
      total: z.number().int(),
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
      proficiency: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
    })
  ),
  skills: z.array(
    z.object({
      skillId: z.string(),
      code: z.string(),
      label: z.string(),
      ability: abilityCodeSchema,
      total: z.number().int(),
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
      proficiency: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
    })
  ),
  exhaustion: characterSheetExhaustionDtoSchema,
  conditions: z.array(characterSheetConditionDtoSchema),
  hitDice: z.array(characterSheetHitDiceDtoSchema)
})

export const characterSheetOutcomeScalingDtoSchema = z.object({
  level: z.number().int().positive(),
  expression: z.string()
})

export const characterSheetOutcomeDtoSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('DAMAGE'),
    pathCode: z.string(),
    expression: z.string(),
    damageTypeId: z.string(),
    damageTypeLabel: z.string(),
    scaling: z.array(characterSheetOutcomeScalingDtoSchema).optional()
  }),
  z.object({
    kind: z.literal('HEAL'),
    pathCode: z.string(),
    expression: z.string(),
    temporary: z.boolean(),
    scaling: z.array(characterSheetOutcomeScalingDtoSchema).optional()
  }),
  z.object({
    kind: z.literal('CONDITION'),
    pathCode: z.string(),
    conditionId: z.string(),
    label: z.string()
  }),
  z.object({
    kind: z.literal('EFFECT'),
    pathCode: z.string(),
    effectKind: z.string(),
    label: z.string().optional()
  })
])

export const characterSheetMechanicDtoSchema = z.object({
  effectId: z.string(),
  trigger: z.string(),
  activation: z
    .object({
      kind: z.string(),
      amount: z.number().int().positive()
    })
    .optional(),
  rangeLabel: z.string().optional(),
  attackBonus: z.number().int().optional(),
  attackRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).optional(),
  save: z
    .object({
      ability: abilityCodeSchema,
      dc: z.number().int().optional()
    })
    .optional(),
  outcomes: z.array(characterSheetOutcomeDtoSchema)
})

export const characterSheetActionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['ACTION', 'BONUS_ACTION', 'REACTION', 'OTHER']),
  sourceLabel: z.string().optional(),
  description: z.string().optional(),
  rollable: z.boolean().optional(),
  mechanic: characterSheetMechanicDtoSchema.optional(),
  availability: z.discriminatedUnion('status', [
    z.object({ status: z.literal('AVAILABLE') }),
    z.object({
      status: z.literal('UNAVAILABLE'),
      reasonCode: characterActionReasonCodeSchema
    })
  ]),
  resourceGrantId: z.string().optional(),
  resourceCost: z.number().int().positive().optional()
})

const characterSheetExtraKindOptionDtoSchema = z.object({
  code: z.enum(['COMPANION', 'MOUNT', 'OWNED', 'VEHICLE']),
  label: z.string().min(1)
})

const characterSheetCreatureOriginOptionDtoSchema = z.object({
  code: z.enum(['WORLD', 'SUMMONED']),
  label: z.string().min(1)
})

const characterSheetExtraActionDtoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional()
})

const characterSheetExtraFeatureDtoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional()
})

const characterSheetExtraHitPointsDtoSchema = z.object({
  current: z.number().int().nonnegative(),
  maximum: z.number().int().nonnegative()
})

const characterSheetExtraCreatureHitPointsDtoSchema = characterSheetExtraHitPointsDtoSchema.extend({
  temp: z.number().int().nonnegative()
})

const characterSheetExtraHitDiceDtoSchema = z
  .array(
    z
      .object({
        die: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        used: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative()
      })
      .refine(({ remaining, total, used }) => used <= total && remaining === total - used, {
        message: 'Hit dice usage and remaining count must be consistent.'
      })
  )
  .superRefine((hitDice, context) => {
    const seen = new Set<number>()

    hitDice.forEach(({ die }, index) => {
      if (seen.has(die)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'die'],
          message: 'Hit dice denominations must be unique.'
        })
      }
      seen.add(die)
    })
  })

const characterSheetExtraCommonDtoSchema = z.object({
  id: z.guid(),
  kindLabel: z.string().min(1),
  authoredName: z.string().min(1),
  displayName: z.string().min(1),
  customName: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
  actions: z.array(characterSheetExtraActionDtoSchema),
  features: z.array(characterSheetExtraFeatureDtoSchema),
  equipmentItemIds: z.array(z.guid())
})

const characterSheetCreatureExtraDtoSchema = characterSheetExtraCommonDtoSchema.extend({
  kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
  creatureId: z.guid(),
  relationshipKind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
  relationshipLabel: z.string().min(1),
  size: sizeCodeSchema.optional(),
  alignmentId: z.guid().optional(),
  creatureTypeId: z.guid().optional(),
  originKind: z.enum(['WORLD', 'SUMMONED']),
  originLabel: z.string().min(1),
  armorClass: z.number().int().nonnegative(),
  speedLabel: z.string().min(1).optional(),
  carryingCapacityLabel: z.string().min(1).optional(),
  riderCapacity: z.number().int().nonnegative().optional(),
  hitPoints: characterSheetExtraCreatureHitPointsDtoSchema,
  hitDice: characterSheetExtraHitDiceDtoSchema
})

const characterSheetVehicleExtraDtoSchema = characterSheetExtraCommonDtoSchema.extend({
  kind: z.literal('VEHICLE'),
  vehicleId: z.guid(),
  categoryLabel: z.string().min(1),
  speedLabel: z.string().min(1).optional(),
  crewLabel: z.string().min(1).optional(),
  passengerCapacity: z.number().int().nonnegative().optional(),
  cargoCapacityLabel: z.string().min(1).optional(),
  hitPoints: characterSheetExtraHitPointsDtoSchema
})

const characterSheetCreatureExtraOptionDtoSchema = z.object({
  id: z.guid(),
  label: z.string().min(1),
  description: z.string().optional(),
  creatureTypeLabel: z.string().min(1).optional(),
  sizeLabel: z.string().min(1).optional(),
  armorClass: z.number().int().nonnegative().optional(),
  maximumHitPoints: z.number().int().nonnegative().optional(),
  speedLabel: z.string().min(1).optional()
})

const characterSheetVehicleExtraOptionDtoSchema = z.object({
  id: z.guid(),
  label: z.string().min(1),
  description: z.string().optional(),
  categoryLabel: z.string().min(1).optional(),
  maximumHitPoints: z.number().int().nonnegative().optional(),
  speedLabel: z.string().min(1).optional()
})

export const characterSheetExtrasDtoSchema = z.object({
  kindOptions: z.array(characterSheetExtraKindOptionDtoSchema),
  originOptions: z.array(characterSheetCreatureOriginOptionDtoSchema),
  creatureOptions: z.array(characterSheetCreatureExtraOptionDtoSchema),
  vehicleOptions: z.array(characterSheetVehicleExtraOptionDtoSchema),
  items: z.array(
    z.union([characterSheetCreatureExtraDtoSchema, characterSheetVehicleExtraDtoSchema])
  )
})

export const characterSheetResourceDtoSchema = z.object({
  id: z.string(),
  owner: characterResourceOwnerRefDtoSchema,
  label: z.string(),
  description: z.string().optional(),
  sourceLabel: z.string(),
  sourceFeatureId: z.string().optional(),
  used: z.number().int(),
  max: z.number().int(),
  remaining: z.number().int(),
  recoveries: z.array(characterResourceRecoveryDtoSchema)
})

export const characterSheetSpellSlotDtoSchema = z.object({
  slotKey: z.string(),
  label: z.string(),
  level: z.number().int().nullable(),
  used: z.number().int(),
  max: z.number().int(),
  remaining: z.number().int()
})

export const characterSheetSpellSourceDtoSchema = z.object({
  id: z.string().optional(),
  source: characterSpellSourceRefDtoSchema,
  classId: z.string().optional(),
  label: z.string(),
  provenance: z
    .enum(['CLASS', 'SUBCLASS', 'RACE', 'BACKGROUND', 'FEAT', 'FEATURE', 'OPTION', 'EQUIPMENT'])
    .optional(),
  acquisition: z.enum(['KNOWN', 'PREPARED', 'ALWAYS_PREPARED', 'GRANTED']).optional(),
  castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']).optional(),
  fixedLevel: z.number().int().positive().optional(),
  resourceGrantId: z.string().optional(),
  resourceOwner: characterResourceOwnerRefDtoSchema.optional(),
  customName: z.string().optional(),
  notes: z.string().optional(),
  displayAsAttack: z.boolean().optional(),
  canPrepare: z.boolean(),
  prepared: z.boolean().optional()
})

export const characterSheetSpellPreparationSourceDtoSchema = z.object({
  classId: z.string(),
  label: z.string(),
  preparedSpellLimit: z.number().int().min(0).optional(),
  preparedSpellIds: z.array(z.string())
})

export const characterSheetSpellDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  level: z.number().int(),
  school: z.string().optional(),
  castingTime: castingTimeDtoSchema.optional(),
  components: z.array(spellComponentSchema).optional(),
  attributes: z.array(spellAttributeSchema).optional(),
  materialDescription: z.string().optional(),
  prepared: z.boolean().optional(),
  known: z.boolean().optional(),
  sourceLabel: z.string().optional(),
  sources: z.array(characterSheetSpellSourceDtoSchema).optional(),
  mechanics: z.array(characterSheetMechanicDtoSchema).optional()
})

export const characterSheetActiveSpellEntryDtoSchema = z.object({
  rowId: z.string().min(1),
  target: z.object({
    kind: z.literal('SPELL'),
    source: characterSpellSourceRefDtoSchema,
    castLevel: z.number().int().nonnegative()
  }),
  spellId: z.guid(),
  source: characterSpellSourceRefDtoSchema,
  sourceId: z.string().min(1),
  displayName: z.string().min(1),
  sourceLabel: z.string().min(1).optional(),
  sourceQualifier: z.string().min(1).optional(),
  castLevel: z.number().int().nonnegative(),
  activationType: activationCodeSchema.optional(),
  activationLabel: z.string().min(1).optional(),
  rangeLabel: z.string().min(1).optional(),
  hitOrDcLabel: z.string().min(1).optional(),
  primaryEffect: z.string().min(1).optional(),
  mechanics: z.array(characterSheetMechanicDtoSchema).optional(),
  available: z.boolean(),
  unavailableReason: z.string().min(1).optional(),
  cast: z.object({
    spellId: z.guid(),
    sourceId: z.string().min(1),
    slotKey: z.string().min(1).optional()
  })
})

export const characterSheetActiveSpellGroupDtoSchema = z.object({
  level: z.number().int().nonnegative(),
  label: z.string().min(1),
  entries: z.array(characterSheetActiveSpellEntryDtoSchema)
})

export const characterSheetEquipmentPropertyDtoSchema = z.object({
  code: equipmentPropertyCodeSchema,
  label: z.string().min(1)
})

export const characterSheetInventoryItemDtoSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  label: z.string(),
  equipmentLabel: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  properties: z.array(characterSheetEquipmentPropertyDtoSchema).optional(),
  rarityId: z.string().optional(),
  cost: costDtoSchema.optional(),
  costLabel: z.string().optional(),
  weight: weightDtoSchema.optional(),
  armorClass: z.number().int().optional(),
  customName: z.string().optional(),
  quantity: z.number().int(),
  equipped: z.boolean(),
  attuned: z.boolean(),
  requiresAttunement: z.boolean(),
  displayAsAttack: z.boolean().optional(),
  containerId: z.string().optional(),
  capacity: capacityDtoSchema.optional(),
  notes: z.string().optional()
})

export const characterSheetCurrencyDtoSchema = z.object({
  currencyId: z.string(),
  label: z.string(),
  amount: z.number(),
  containerId: z.string().optional()
})

export const characterSheetReferenceDtoSchema = z.object({
  features: z.array(characterSheetReferenceFeatureDtoSchema),
  proficiencies: z.array(characterSheetProficiencyFactDtoSchema),
  defenses: z.array(
    characterSheetFactDtoSchema.extend({
      kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
      damageTypeId: z.string()
    })
  ),
  senses: z.array(
    characterSheetFactDtoSchema.extend({
      senseId: z.string(),
      range: rangeDtoSchema.optional()
    })
  ),
  conditionOptions: z.array(
    characterSheetOptionDtoSchema.extend({
      code: z.string().trim().min(1)
    })
  ),
  equipmentOptions: z.array(
    characterSheetOptionDtoSchema.extend({
      isContainer: z.boolean(),
      maxStack: z.number().int().positive().optional(),
      requiresAttunement: z.boolean()
    })
  ),
  currencyOptions: z.array(characterSheetOptionDtoSchema)
})

export const characterSheetNotesDtoSchema = z.object({
  alignment: z.string().optional(),
  lifestyle: z.string().optional(),
  faith: z.string().optional(),
  gender: z.string().optional(),
  age: z.string().optional(),
  appearance: z.string().optional(),
  personalityTraits: z.string().optional(),
  ideals: z.string().optional(),
  bonds: z.string().optional(),
  flaws: z.string().optional(),
  organizations: z.string().optional(),
  allies: z.string().optional(),
  enemies: z.string().optional(),
  backstory: z.string().optional(),
  notes: z.string().optional(),
  groups: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        sortOrder: z.number().int(),
        kind: z.enum(['SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM'])
      })
    )
    .optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        body: z.string().optional(),
        groupId: z.string(),
        pinned: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string()
      })
    )
    .optional()
})

export const characterSheetResponseDtoSchema = z.object({
  publicId: z.string().optional(),
  meta: characterSheetMetaDtoSchema,
  identity: characterSheetIdentityDtoSchema,
  overview: characterSheetOverviewDtoSchema,
  actions: z.object({
    items: z.array(characterSheetActionDtoSchema)
  }),
  resources: z.object({
    items: z.array(characterSheetResourceDtoSchema),
    hitDice: z.array(characterSheetHitDiceDtoSchema)
  }),
  spells: z.object({
    saveDc: z.number().int().nullable(),
    attackBonus: z.number().int().nullable(),
    attackRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).optional(),
    slots: z.array(characterSheetSpellSlotDtoSchema),
    activeGroups: z.array(characterSheetActiveSpellGroupDtoSchema),
    spells: z.array(characterSheetSpellDtoSchema),
    preparationSources: z.array(characterSheetSpellPreparationSourceDtoSchema).optional()
  }),
  inventory: z.object({
    items: z.array(characterSheetInventoryItemDtoSchema),
    currencies: z.array(characterSheetCurrencyDtoSchema),
    containers: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          capacity: capacityDtoSchema.optional(),
          itemIds: z.array(z.string()),
          currencies: z.array(characterSheetCurrencyDtoSchema)
        })
      )
      .optional()
  }),
  extras: characterSheetExtrasDtoSchema,
  reference: characterSheetReferenceDtoSchema,
  notes: characterSheetNotesDtoSchema
})

export type CharacterSheetResponseDto = z.infer<typeof characterSheetResponseDtoSchema>
export type CharacterSheetExtrasDto = z.infer<typeof characterSheetExtrasDtoSchema>
