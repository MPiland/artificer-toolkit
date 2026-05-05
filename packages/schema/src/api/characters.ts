import { z } from 'zod'

import {
  abilityCodeSchema,
  authoredRecordStatusSchema,
  spellAttributeSchema,
  spellComponentSchema
} from '../shared/enums.js'
import { unknownObjectSchema } from '../shared/facet.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import {
  characterAncestryAcquisitionDtoSchema,
  characterAuthoredDtoSchema,
  characterClassIntentDtoSchema,
  characterFeatureAcquisitionRecordDtoSchema,
  characterHitpointLevelEntryDtoSchema,
  characterProfileAuthoredDtoSchema,
  characterProvenanceDtoSchema,
  characterResourceGrantRecordDtoSchema,
  characterSpellSelectionRecordDtoSchema,
  characterStartingEquipmentDecisionDtoSchema,
  characterStateDtoSchema
} from '../subjects/index.js'
import { castingTimeDtoSchema, classStartingGoldDtoSchema } from '../subjects/shared.js'
import { listResponseDtoSchema } from './common.js'

export const characterBuilderModeDtoSchema = z.enum(['create', 'edit'])

export const characterBuilderAbilityAssignmentFormDtoSchema = z.object({
  ability: abilityCodeSchema,
  option: z.string()
})

export const characterBuilderManualAbilityAssignmentFormDtoSchema = z.object({
  ability: abilityCodeSchema,
  score: z.number().int()
})

export const characterBuilderAbilitiesFormDtoSchema = z.object({
  method: z.string(),
  assignments: z.array(characterBuilderAbilityAssignmentFormDtoSchema),
  state: z.object({
    assignments: z.array(characterBuilderManualAbilityAssignmentFormDtoSchema),
    rollGroups: z.array(unknownObjectSchema).optional()
  }).optional()
})

export const characterBuilderAbilitiesIntentCacheDtoSchema = z.object({
  activeMethod: z.string(),
  methods: z.record(z.string(), characterBuilderAbilitiesFormDtoSchema)
})

export const characterBuilderIntentCacheDtoSchema = z.object({
  abilities: characterBuilderAbilitiesIntentCacheDtoSchema.optional()
})

export const characterBuilderFormDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  profile: characterProfileAuthoredDtoSchema,
  intent: z.object({
    advancement: z.object({
      method: z.string(),
      experience: z.number().int()
        .optional()
    }),
    race: z.object({
      raceId: z.string(),
      subraceId: z.string().optional()
    }),
    ancestrySelections: z.array(characterAncestryAcquisitionDtoSchema).optional(),
    background: z.object({
      backgroundId: z.string()
    }),
    classes: z.array(characterClassIntentDtoSchema),
    abilities: characterBuilderAbilitiesFormDtoSchema,
    hitpoints: z.object({
      method: z.string(),
      levels: z.array(characterHitpointLevelEntryDtoSchema)
    }),
    startingEquipment: z.object({
      class: characterStartingEquipmentDecisionDtoSchema.optional(),
      background: characterStartingEquipmentDecisionDtoSchema.optional()
    }).optional(),
    featureAcquisitions: z.array(characterFeatureAcquisitionRecordDtoSchema),
    spellSelections: z.array(characterSpellSelectionRecordDtoSchema).optional(),
    resourceGrants: z.array(characterResourceGrantRecordDtoSchema).optional()
  }),
  state: characterStateDtoSchema,
  builderIntent: characterBuilderIntentCacheDtoSchema.optional(),
  systemId: z.string(),
  userId: z.string()
})

export const characterBuilderDraftStateDtoSchema = z.enum([
  'DRAFT_ONLY',
  'ACTIVE_WITH_DRAFT'
])

export const characterBuilderDraftSummaryDtoSchema = z.object({
  characterId: z.string(),
  userId: z.string(),
  systemId: z.string(),
  label: z.string(),
  status: z.literal('DRAFT'),
  draftState: characterBuilderDraftStateDtoSchema,
  baseActiveUpdatedAt: z.string().nullable()
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const characterListItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: authoredRecordStatusSchema,
  systemId: z.string(),
  streamVersion: z.number().int(),
  draft: characterBuilderDraftSummaryDtoSchema.nullable().optional()
})

export const characterListResponseDtoSchema = listResponseDtoSchema(characterListItemDtoSchema)

export const characterBuilderClassSummaryDtoSchema = z.object({
  classId: z.string(),
  classLabel: z.string(),
  classLevel: z.number().int(),
  subclassId: z.string().optional(),
  subclassLabel: z.string().optional(),
  specializationId: z.string().optional(),
  specializationLabel: z.string().optional(),
  featureLabels: z.array(z.string()),
  resourceLabels: z.array(z.string()),
  spellcastingLabels: z.array(z.string())
})

export const characterBuilderSummaryDtoSchema = z.object({
  totalLevel: z.number().int(),
  abilities: z.record(z.string(), z.number().int()),
  selectedRace: z.object({
    raceId: z.string(),
    raceLabel: z.string(),
    subraceId: z.string().optional(),
    subraceLabel: z.string().optional(),
    ancestryId: z.string().optional(),
    ancestryLabel: z.string().optional(),
    ancestryOptionId: z.string().optional(),
    ancestryOptionLabel: z.string().optional()
  }).optional(),
  selectedBackground: z.object({
    backgroundId: z.string(),
    label: z.string()
  }).optional(),
  classes: z.array(characterBuilderClassSummaryDtoSchema)
})

export const characterBuilderGrantSummaryItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema
})

export const characterBuilderGrantedContentDtoSchema = z.object({
  features: z.array(characterBuilderGrantSummaryItemDtoSchema),
  resources: z.array(characterBuilderGrantSummaryItemDtoSchema),
  spellcasting: z.array(characterBuilderGrantSummaryItemDtoSchema)
})

export const characterBuilderIssueDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema.optional(),
  required: z.boolean()
})

export const characterBuilderValidationDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['blocking', 'warning'])
})

export const characterBuilderReadinessDtoSchema = z.object({
  ready: z.boolean(),
  blockingIssues: z.array(z.string()),
  outstandingRequiredChoices: z.array(z.string())
})

export const characterBuilderSectionIdDtoSchema = z.enum([
  'BASICS',
  'RACE',
  'CLASSES',
  'BACKGROUND',
  'DETAILS',
  'NOTES',
  'ABILITIES',
  'EQUIPMENT',
  'REVIEW'
])

export const characterBuilderResolutionDtoSchema = z.object({
  mode: characterBuilderModeDtoSchema,
  summary: characterBuilderSummaryDtoSchema,
  grants: characterBuilderGrantedContentDtoSchema,
  outstandingChoices: z.array(characterBuilderIssueDtoSchema),
  validations: z.array(characterBuilderValidationDtoSchema),
  readiness: characterBuilderReadinessDtoSchema,
  recommendedSectionId: characterBuilderSectionIdDtoSchema
})

export const characterBuilderReferenceOptionDtoSchema = z.object({
  id: z.string(),
  label: z.string()
})

export const characterBuilderRaceReferenceDtoSchema = characterBuilderReferenceOptionDtoSchema.extend({
  category: z.string().optional(),
  parentRaceId: z.string().optional(),
  ancestry: z.object({
    id: z.string(),
    label: z.string(),
    options: z.array(characterBuilderReferenceOptionDtoSchema)
  }).optional()
})

export const characterBuilderClassReferenceDtoSchema = characterBuilderReferenceOptionDtoSchema.extend({
  category: z.string().optional(),
  parentClassId: z.string().optional(),
  specializations: z.array(characterBuilderReferenceOptionDtoSchema).optional()
})

export const characterBuilderReferencesDtoSchema = z.object({
  races: z.array(characterBuilderRaceReferenceDtoSchema),
  classes: z.array(characterBuilderClassReferenceDtoSchema),
  backgrounds: z.array(characterBuilderReferenceOptionDtoSchema),
  equipment: z.array(characterBuilderReferenceOptionDtoSchema),
  currencies: z.array(characterBuilderReferenceOptionDtoSchema)
})

export const characterBuilderChoiceOptionDtoSchema = characterBuilderReferenceOptionDtoSchema.extend({
  category: z.string().optional(),
  disabled: z.boolean().optional(),
  disabledReason: z.string().optional(),
  properties: z.array(z.string()).optional()
})

export const characterBuilderFeatureChoiceViewDtoSchema = z.object({
  featureId: z.string(),
  featureLabel: z.string(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema,
  selectionKey: z.string(),
  requiredCount: z.number().int(),
  selectedOptionIds: z.array(z.string()),
  options: z.array(characterBuilderChoiceOptionDtoSchema)
})

export const characterBuilderSpellChoiceViewDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema,
  cantripLimit: z.number().int(),
  learnedSpellLimit: z.number().int(),
  selectedCantripIds: z.array(z.string()),
  selectedSpellIds: z.array(z.string()),
  cantripOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  spellOptions: z.array(characterBuilderChoiceOptionDtoSchema)
})

export const characterBuilderRaceViewDtoSchema = z.object({
  raceOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  subraceOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  ancestry: z.object({
    ancestryId: z.string(),
    label: z.string(),
    selectedOptionId: z.string().optional(),
    options: z.array(characterBuilderChoiceOptionDtoSchema)
  }).nullable(),
  featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema)
})

export const characterBuilderClassViewItemDtoSchema = z.object({
  classId: z.string(),
  classLabel: z.string(),
  classLevel: z.number().int(),
  classOptions: z.array(characterBuilderChoiceOptionDtoSchema).optional(),
  subclassOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  specializationOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  featureLabels: z.array(z.string()),
  featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema),
  spellChoices: z.array(characterBuilderSpellChoiceViewDtoSchema),
  resourceLabels: z.array(z.string()),
  spellcastingLabels: z.array(z.string())
})

export const characterBuilderClassViewDtoSchema = z.object({
  classOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  selectedClasses: z.array(characterBuilderClassViewItemDtoSchema)
})

export const characterBuilderBackgroundViewDtoSchema = z.object({
  backgroundOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema)
})

export const characterBuilderStartingEquipmentViewDtoSchema = z.object({
  source: z.enum(['CLASS', 'BACKGROUND']),
  sourceLabel: z.string(),
  startingGold: classStartingGoldDtoSchema.nullable().optional(),
  startingEquipment: startingEquipmentDtoSchema
})

export const characterBuilderEquipmentViewDtoSchema = z.object({
  classStartingEquipmentRequired: z.boolean(),
  backgroundStartingEquipmentRequired: z.boolean(),
  classStartingEquipment: characterBuilderStartingEquipmentViewDtoSchema.nullable(),
  backgroundStartingEquipment: characterBuilderStartingEquipmentViewDtoSchema.nullable(),
  equipmentOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  currencyOptions: z.array(characterBuilderChoiceOptionDtoSchema)
})

export const characterBuilderReviewViewDtoSchema = z.object({
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  ready: z.boolean()
})

export const characterBuilderViewDtoSchema = z.object({
  race: characterBuilderRaceViewDtoSchema,
  classes: characterBuilderClassViewDtoSchema,
  background: characterBuilderBackgroundViewDtoSchema,
  equipment: characterBuilderEquipmentViewDtoSchema,
  review: characterBuilderReviewViewDtoSchema
})

export const characterBuilderPayloadDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  resolution: characterBuilderResolutionDtoSchema,
  references: characterBuilderReferencesDtoSchema,
  view: characterBuilderViewDtoSchema,
  builderIntent: characterBuilderIntentCacheDtoSchema.optional(),
  baseActiveUpdatedAt: z.string().nullable()
    .optional()
})

export const characterBuilderDraftPayloadDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  builderIntent: characterBuilderIntentCacheDtoSchema.optional()
})

export const characterBuilderDraftDtoSchema = characterBuilderDraftSummaryDtoSchema.extend({
  id: z.string(),
  payload: unknownObjectSchema,
  mode: characterBuilderModeDtoSchema
})

export const characterBuilderPreviewEntryDtoSchema = z.object({
  id: z.string(),
  label: z.string()
})

export const characterBuilderChangePreviewDtoSchema = z.object({
  predictedStatus: authoredRecordStatusSchema,
  downgradesStatus: z.boolean(),
  removedAncestrySelections: z.array(characterBuilderPreviewEntryDtoSchema),
  removedFeatureAcquisitions: z.array(characterBuilderPreviewEntryDtoSchema),
  removedSpellSelections: z.array(characterBuilderPreviewEntryDtoSchema),
  removedResourceGrants: z.array(characterBuilderPreviewEntryDtoSchema),
  clearedStartingEquipmentSources: z.array(z.enum(['CLASS', 'BACKGROUND'])),
  summaryLines: z.array(z.string()),
  destructive: z.boolean()
})

export const characterBuilderPreviewPayloadDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  resolution: characterBuilderResolutionDtoSchema,
  preview: characterBuilderChangePreviewDtoSchema
})

export const characterDraftRequestDtoSchema = z.object({
  id: z.string().min(1),
  systemId: z.string().min(1)
    .optional()
})

export const characterBuilderDraftSaveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  builderIntent: characterBuilderIntentCacheDtoSchema.optional(),
  mode: characterBuilderModeDtoSchema,
  baseActiveUpdatedAt: z.string().nullable()
    .optional()
})

export const characterBuilderResolveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema
})

export const characterBuilderSaveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema,
  targetStatus: authoredRecordStatusSchema.optional()
})

export const characterBuilderCommitRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema,
  targetStatus: z.literal('ACTIVE').optional(),
  baseActiveUpdatedAt: z.string().nullable()
    .optional()
})

export const characterSheetFactDtoSchema = z.object({
  label: z.string(),
  value: z.string()
})

export const characterSheetOptionDtoSchema = z.object({
  id: z.string(),
  label: z.string()
})

export const characterSheetMetaDtoSchema = z.object({
  characterId: z.string(),
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
  modifier: z.number().int()
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
  notes: z.string().optional()
})

export const characterSheetOverviewDtoSchema = z.object({
  abilities: z.array(characterSheetAbilityDtoSchema),
  facts: z.array(characterSheetFactDtoSchema),
  armorClass: z.number().int(),
  initiative: z.number().int(),
  proficiencyBonus: z.number().int(),
  currentHitPoints: z.number().int(),
  maxHitPoints: z.number().int(),
  tempHitPoints: z.number().int(),
  maxHitPointsOverride: z.number().int()
    .nullable(),
  exhaustionLevel: z.number().int()
    .min(0)
    .max(6),
  exhaustionNotes: z.string().optional(),
  conditions: z.array(characterSheetConditionDtoSchema),
  hitDice: z.array(characterSheetHitDiceDtoSchema)
})

export const characterSheetActionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum([
    'ACTION', 'BONUS_ACTION', 'REACTION', 'OTHER'
  ]),
  sourceLabel: z.string().optional(),
  description: z.string().optional(),
  rollable: z.boolean().optional()
})

export const characterSheetResourceDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  sourceLabel: z.string(),
  used: z.number().int(),
  max: z.number().int(),
  remaining: z.number().int(),
  recovery: z.enum(['SHORT_REST', 'LONG_REST', 'OTHER']).optional()
})

export const characterSheetSpellSlotDtoSchema = z.object({
  slotKey: z.string(),
  label: z.string(),
  level: z.number().int()
    .nullable(),
  used: z.number().int(),
  max: z.number().int(),
  remaining: z.number().int()
})

export const characterSheetSpellSourceDtoSchema = z.object({
  classId: z.string(),
  label: z.string(),
  prepared: z.boolean().optional()
})

export const characterSheetSpellPreparationSourceDtoSchema = z.object({
  classId: z.string(),
  label: z.string(),
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
  sources: z.array(characterSheetSpellSourceDtoSchema)
    .optional()
})

export const characterSheetInventoryItemDtoSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  label: z.string(),
  customName: z.string().optional(),
  quantity: z.number().int(),
  equipped: z.boolean(),
  attuned: z.boolean(),
  containerId: z.string().optional(),
  notes: z.string().optional()
})

export const characterSheetCurrencyDtoSchema = z.object({
  currencyId: z.string(),
  label: z.string(),
  amount: z.number(),
  containerId: z.string().optional()
})

export const characterSheetReferenceDtoSchema = z.object({
  features: z.array(characterBuilderGrantSummaryItemDtoSchema),
  proficiencies: z.array(characterSheetFactDtoSchema),
  defenses: z.array(characterSheetFactDtoSchema),
  senses: z.array(characterSheetFactDtoSchema),
  conditionOptions: z.array(characterSheetOptionDtoSchema),
  equipmentOptions: z.array(characterSheetOptionDtoSchema),
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
  notes: z.string().optional()
})

export const characterSheetResponseDtoSchema = z.object({
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
    saveDc: z.number().int()
      .nullable(),
    attackBonus: z.number().int()
      .nullable(),
    slots: z.array(characterSheetSpellSlotDtoSchema),
    spells: z.array(characterSheetSpellDtoSchema),
    preparationSources: z.array(characterSheetSpellPreparationSourceDtoSchema)
      .optional()
  }),
  inventory: z.object({
    items: z.array(characterSheetInventoryItemDtoSchema),
    currencies: z.array(characterSheetCurrencyDtoSchema)
  }),
  reference: characterSheetReferenceDtoSchema,
  notes: characterSheetNotesDtoSchema
})

const characterSheetCommandBaseDtoSchema = z.object({
  commandId: z.string().optional(),
  expectedVersion: z.number().int()
})

export const characterSheetCommandInputDtoSchema = z.discriminatedUnion('type', [
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('SET_HIT_POINTS'),
    current: z.number().int()
      .min(0)
      .optional(),
    temp: z.number().int()
      .min(0)
      .optional(),
    maxOverride: z.number().int()
      .min(0)
      .nullable()
      .optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('ADJUST_HIT_POINTS'),
    mode: z.enum(['DAMAGE', 'HEAL']),
    amount: z.number().int()
      .min(0)
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('USE_HIT_DIE'),
    die: z.number().int()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('APPLY_REST'),
    restKind: z.enum(['SHORT', 'LONG'])
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('SET_EXHAUSTION'),
    level: z.number().int()
      .min(0)
      .max(6),
    notes: z.string().optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('ADD_CONDITION'),
    conditionTypeId: z.string(),
    notes: z.string().optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('REMOVE_CONDITION'),
    conditionTypeId: z.string()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('USE_RESOURCE'),
    resourceGrantId: z.string(),
    amount: z.number().int()
      .min(1)
      .optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('RESTORE_RESOURCE'),
    resourceGrantId: z.string(),
    amount: z.number().int()
      .min(1)
      .optional(),
    all: z.boolean().optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('USE_SPELL_SLOT'),
    slotKey: z.string()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('RESTORE_SPELL_SLOT'),
    slotKey: z.string(),
    all: z.boolean().optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('SET_PREPARED_SPELLS'),
    classId: z.string(),
    spellIds: z.array(z.string())
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('ADD_INVENTORY_ITEM'),
    equipmentId: z.string(),
    quantity: z.number().int()
      .min(1),
    customName: z.string().optional(),
    notes: z.string().optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('REMOVE_INVENTORY_ITEM'),
    itemId: z.string(),
    quantity: z.number().int()
      .min(1)
      .optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('UPDATE_INVENTORY_ITEM'),
    itemId: z.string(),
    quantity: z.number().int()
      .min(0)
      .optional(),
    containerId: z.string().nullable()
      .optional(),
    customName: z.string().nullable()
      .optional(),
    notes: z.string().nullable()
      .optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('EQUIP_ITEM'),
    itemId: z.string()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('UNEQUIP_ITEM'),
    itemId: z.string()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('ATTUNE_ITEM'),
    itemId: z.string()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('UNATTUNE_ITEM'),
    itemId: z.string()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('ADJUST_CURRENCY'),
    currencyId: z.string(),
    amount: z.number().int(),
    containerId: z.string().optional()
  }),
  characterSheetCommandBaseDtoSchema.extend({
    type: z.literal('UPDATE_NOTES'),
    description: z.string().nullable()
      .optional(),
    personalityTraits: z.string().nullable()
      .optional(),
    ideals: z.string().nullable()
      .optional(),
    bonds: z.string().nullable()
      .optional(),
    flaws: z.string().nullable()
      .optional(),
    organizations: z.string().nullable()
      .optional(),
    allies: z.string().nullable()
      .optional(),
    enemies: z.string().nullable()
      .optional(),
    backstory: z.string().nullable()
      .optional(),
    notes: z.string().nullable()
      .optional()
  })
])

export const characterHistoryEntryDtoSchema = z.object({
  eventId: z.string(),
  occurredAt: z.string(),
  actorId: z.string(),
  eventType: z.string(),
  summary: z.string()
})

export const characterHistoryResponseDtoSchema = z.object({
  characterId: z.string(),
  entries: z.array(characterHistoryEntryDtoSchema)
})

export const characterSheetCommandResponseDtoSchema = z.object({
  characterId: z.string(),
  streamVersion: z.number().int(),
  sheet: characterSheetResponseDtoSchema,
  historyEntry: characterHistoryEntryDtoSchema.optional()
})

type CharacterBuilderAbilityCode = z.infer<typeof abilityCodeSchema>
type CharacterBuilderFormStartingEquipmentDecision = z.infer<typeof characterStartingEquipmentDecisionDtoSchema>
type CharacterBuilderFormFeatureAcquisition = z.infer<typeof characterFeatureAcquisitionRecordDtoSchema>
type CharacterBuilderFormSpellSelection = z.infer<typeof characterSpellSelectionRecordDtoSchema>
type CharacterBuilderFormResourceGrant = z.infer<typeof characterResourceGrantRecordDtoSchema>

export type CharacterBuilderModeDto = z.infer<typeof characterBuilderModeDtoSchema>
export type CharacterBuilderFormDto = {
  id: string
  label: string
  description?: string
  status?: string
  profile: Record<string, string | undefined>
  intent: {
    advancement: {
      method: string
      experience?: number
    }
    race: {
      raceId: string
      subraceId?: string
    }
    ancestrySelections?: {
      id: string
      ancestryId: string
      optionId: string
      source: {
        kind: 'RACE'
        raceId: string
      } | {
        kind: 'SUBRACE'
        subraceId: string
      }
      timing: {
        kind: 'IMMEDIATE'
      } | {
        kind: 'CLASS_LEVEL'
        classId: string
        classLevel: number
      }
    }[]
    background: {
      backgroundId: string
    }
    classes: {
      classId: string
      classLevel: number
      subclassId?: string
      specializationId?: string
    }[]
    abilities: {
      method: string
      assignments: {
        ability: CharacterBuilderAbilityCode
        option: string
      }[]
      state?: {
        assignments: {
          ability: CharacterBuilderAbilityCode
          score: number
        }[]
        rollGroups?: Record<string, unknown>[]
      }
    }
    hitpoints: {
      method: string
      levels: {
        level: number
        value: number
        rolls?: {
          die: number
          value: number
        }[]
        overridden?: boolean
      }[]
    }
    startingEquipment?: {
      class?: CharacterBuilderFormStartingEquipmentDecision
      background?: CharacterBuilderFormStartingEquipmentDecision
    }
    featureAcquisitions: CharacterBuilderFormFeatureAcquisition[]
    spellSelections?: CharacterBuilderFormSpellSelection[]
    resourceGrants?: CharacterBuilderFormResourceGrant[]
  }
  state: {
    equipment: {
      inventory: {
        id: string
        equipmentId: string
        quantity: number
        containerId?: string
        customName?: string
        notes?: string
      }[]
      equipped: string[]
      attuned: string[]
    }
    currency: {
      containerId?: string
      currencies: {
        currencyId: string
        amount: number
      }[]
    }[]
    hitpoints: {
      current: number
      temp?: number
      hitDice: {
        die: number
        total: number
        used: number
      }[]
      maxOverride?: number
    }
    classes?: Record<string, unknown>[]
    resources?: Record<string, unknown>[]
    spellSlots?: Record<string, unknown>[]
    conditions?: Record<string, unknown>[]
    exhaustion?: Record<string, unknown>
    creatures?: Record<string, unknown>[]
    vehicles?: Record<string, unknown>[]
    creatureEquipment?: Record<string, Record<string, unknown>[]>
    vehicleEquipment?: Record<string, Record<string, unknown>[]>
  }
  builderIntent?: CharacterBuilderIntentCacheDto
  systemId: string
  userId: string
}
export type CharacterListItemDto = z.infer<typeof characterListItemDtoSchema>
export type CharacterListResponseDto = z.infer<typeof characterListResponseDtoSchema>
export type CharacterBuilderSummaryDto = z.infer<typeof characterBuilderSummaryDtoSchema>
export type CharacterBuilderIssueDto = z.infer<typeof characterBuilderIssueDtoSchema>
export type CharacterBuilderValidationDto = z.infer<typeof characterBuilderValidationDtoSchema>
export type CharacterBuilderReadinessDto = z.infer<typeof characterBuilderReadinessDtoSchema>
export type CharacterBuilderResolutionDto = z.infer<typeof characterBuilderResolutionDtoSchema>
export type CharacterBuilderReferenceOptionDto = z.infer<typeof characterBuilderReferenceOptionDtoSchema>
export type CharacterBuilderRaceReferenceDto = z.infer<typeof characterBuilderRaceReferenceDtoSchema>
export type CharacterBuilderClassReferenceDto = z.infer<typeof characterBuilderClassReferenceDtoSchema>
export type CharacterBuilderReferencesDto = z.infer<typeof characterBuilderReferencesDtoSchema>
export type CharacterBuilderChoiceOptionDto = z.infer<typeof characterBuilderChoiceOptionDtoSchema>
export type CharacterBuilderFeatureChoiceViewDto = z.infer<typeof characterBuilderFeatureChoiceViewDtoSchema>
export type CharacterBuilderSpellChoiceViewDto = z.infer<typeof characterBuilderSpellChoiceViewDtoSchema>
export type CharacterBuilderRaceViewDto = z.infer<typeof characterBuilderRaceViewDtoSchema>
export type CharacterBuilderClassViewItemDto = z.infer<typeof characterBuilderClassViewItemDtoSchema>
export type CharacterBuilderClassViewDto = z.infer<typeof characterBuilderClassViewDtoSchema>
export type CharacterBuilderBackgroundViewDto = z.infer<typeof characterBuilderBackgroundViewDtoSchema>
export type CharacterBuilderStartingEquipmentViewDto = z.infer<typeof characterBuilderStartingEquipmentViewDtoSchema>
export type CharacterBuilderEquipmentViewDto = z.infer<typeof characterBuilderEquipmentViewDtoSchema>
export type CharacterBuilderReviewViewDto = z.infer<typeof characterBuilderReviewViewDtoSchema>
export type CharacterBuilderViewDto = z.infer<typeof characterBuilderViewDtoSchema>
export type CharacterBuilderPayloadDto = z.infer<typeof characterBuilderPayloadDtoSchema>
export type CharacterBuilderAbilitiesIntentCacheDto = z.infer<typeof characterBuilderAbilitiesIntentCacheDtoSchema>
export type CharacterBuilderIntentCacheDto = z.infer<typeof characterBuilderIntentCacheDtoSchema>
export type CharacterBuilderDraftPayloadDto = z.infer<typeof characterBuilderDraftPayloadDtoSchema>
export type CharacterBuilderDraftStateDto = z.infer<typeof characterBuilderDraftStateDtoSchema>
export type CharacterBuilderDraftSummaryDto = z.infer<typeof characterBuilderDraftSummaryDtoSchema>
export type CharacterBuilderDraftDto = z.infer<typeof characterBuilderDraftDtoSchema>
export type CharacterBuilderChangePreviewDto = z.infer<typeof characterBuilderChangePreviewDtoSchema>
export type CharacterBuilderPreviewPayloadDto = z.infer<typeof characterBuilderPreviewPayloadDtoSchema>
export type CharacterDraftRequestDto = z.infer<typeof characterDraftRequestDtoSchema>
export type CharacterBuilderDraftSaveRequestDto = z.infer<typeof characterBuilderDraftSaveRequestDtoSchema>
export type CharacterBuilderResolveRequestDto = z.infer<typeof characterBuilderResolveRequestDtoSchema>
export type CharacterBuilderSaveRequestDto = z.infer<typeof characterBuilderSaveRequestDtoSchema>
export type CharacterBuilderCommitRequestDto = z.infer<typeof characterBuilderCommitRequestDtoSchema>
export type CharacterSheetResponseDto = z.infer<typeof characterSheetResponseDtoSchema>
export type CharacterHistoryEntryDto = z.infer<typeof characterHistoryEntryDtoSchema>
export type CharacterHistoryResponseDto = z.infer<typeof characterHistoryResponseDtoSchema>
export type CharacterSheetCommandInputDto = z.infer<typeof characterSheetCommandInputDtoSchema>
export type CharacterSheetCommandResponseDto = z.infer<typeof characterSheetCommandResponseDtoSchema>
