import { z } from 'zod'

import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  getCharacterChosenGrantSelectionIdentityKey
} from '@artificer-toolkit/shared/subjects/authored'

import { abilityCodeSchema } from '../shared/enums.js'

const characterProfileAuthoredDtoSchemaRaw = z.object({
  alignmentId: z.string().optional(),
  lifestyleId: z.string().optional(),
  faith: z.string().optional(),
  gender: z.string().optional(),
  age: z.string().optional(),
  eyes: z.string().optional(),
  hair: z.string().optional(),
  skin: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  physicalCharacteristics: z.string().optional(),
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
const characterProvenanceDtoSchemaRaw = z.union([
  z.object({
    kind: z.literal('CLASS'),
    classId: z.string(),
    classLevel: z.number().int().optional()
  }),
  z.object({
    kind: z.literal('SUBCLASS'),
    subclassId: z.string(),
    classLevel: z.number().int().optional()
  }),
  z.object({ kind: z.literal('RACE'), raceId: z.string() }),
  z.object({ kind: z.literal('SUBRACE'), subraceId: z.string() }),
  z.object({ kind: z.literal('ANCESTRY'), ancestryId: z.string(), optionId: z.string() }),
  z.object({ kind: z.literal('BACKGROUND'), backgroundId: z.string() }),
  z.object({ kind: z.literal('FEAT'), featId: z.string() }),
  z.object({ kind: z.literal('FEATURE'), featureId: z.string() }),
  z.object({ kind: z.literal('OPTION'), acquiredParentId: z.string(), optionId: z.string() }),
  z.object({ kind: z.literal('MANUAL'), reason: z.string().optional() })
])
const characterAcquisitionTimingDtoSchemaRaw = z.union([
  z.object({ kind: z.literal('IMMEDIATE') }),
  z.object({ kind: z.literal('CHARACTER_LEVEL'), level: z.number().int() }),
  z.object({ kind: z.literal('CLASS_LEVEL'), classId: z.string(), classLevel: z.number().int() })
])
const characterFeatureSelectionValueDtoSchemaRaw = z.union([
  z.object({ kind: z.literal('ID'), id: z.string() }),
  z.object({ kind: z.literal('IDS'), ids: z.array(z.string()) }),
  z.object({ kind: z.literal('NUMBER'), value: z.number() }),
  z.object({ kind: z.literal('BOOLEAN'), value: z.boolean() })
])
const characterFeatureSelectionRecordDtoSchemaRaw = z.object({
  selectionKey: z.string(),
  values: z.array(characterFeatureSelectionValueDtoSchemaRaw)
})
const characterFeatureAcquisitionRecordDtoSchemaRaw = z.object({
  id: z.string(),
  featureId: z.string(),
  source: characterProvenanceDtoSchemaRaw,
  timing: characterAcquisitionTimingDtoSchemaRaw,
  selections: z.array(characterFeatureSelectionRecordDtoSchemaRaw).optional()
})
const characterChosenGrantSelectionRecordDtoSchemaRaw = z.object({
  id: z.string(),
  grantId: z.string(),
  source: characterProvenanceDtoSchemaRaw,
  timing: characterAcquisitionTimingDtoSchemaRaw,
  progressionLevel: z.number().int().positive().optional(),
  targetIds: z.array(z.string())
})
const characterChosenGrantSelectionsDtoSchemaRaw = z
  .array(characterChosenGrantSelectionRecordDtoSchemaRaw)
  .superRefine((selections, context) => {
    const seen = new Set<string>()
    selections.forEach((selection, index) => {
      const identity = getCharacterChosenGrantSelectionIdentityKey(selection)
      if (seen.has(identity))
        context.addIssue({
          code: 'custom',
          path: [index],
          message: 'Chosen grant selections must be unique by grant, source, and progression level.'
        })
      seen.add(identity)
    })
  })
const characterAdvancementIntentDtoSchemaRaw = z.union([
  z.object({
    method: z.literal(ADVANCEMENT_METHOD_CODE.EXPERIENCE),
    experience: z.number().int().optional()
  }),
  z.object({ method: z.literal(ADVANCEMENT_METHOD_CODE.MILESTONE) })
])
const characterDieRollRecordDtoSchemaRaw = z.object({
  die: z.number().int(),
  value: z.number().int()
})
const characterHitpointLevelEntryDtoSchemaRaw = z.object({
  level: z.number().int().positive(),
  classId: z.string().min(1),
  classLevel: z.number().int().positive(),
  value: z.number().int(),
  rolls: z.array(characterDieRollRecordDtoSchemaRaw).optional(),
  overridden: z.boolean().optional()
})
const characterRaceIntentDtoSchemaRaw = z.object({
  raceId: z.string(),
  subraceId: z.string().optional()
})
const characterBackgroundIntentDtoSchemaRaw = z.object({ backgroundId: z.string() })
const characterAncestryAcquisitionDtoSchemaRaw = z.object({
  id: z.string(),
  ancestryId: z.string(),
  optionId: z.string(),
  source: z.union([
    z.object({ kind: z.literal('RACE'), raceId: z.string() }),
    z.object({ kind: z.literal('SUBRACE'), subraceId: z.string() })
  ]),
  timing: z.union([
    z.object({ kind: z.literal('IMMEDIATE') }),
    z.object({ kind: z.literal('CLASS_LEVEL'), classId: z.string(), classLevel: z.number().int() })
  ])
})
const characterClassIntentDtoSchemaRaw = z.object({
  classId: z.string(),
  classLevel: z.number().int(),
  subclassId: z.string().optional(),
  specializationId: z.string().optional()
})
const characterManualAbilityAssignmentDtoSchemaRaw = z.object({
  ability: abilityCodeSchema,
  score: z.number().int()
})
const characterAbilityRollGroupRecordDtoSchemaRaw = z.object({
  id: z.string(),
  rolls: z.array(characterDieRollRecordDtoSchemaRaw),
  kept: z.array(characterDieRollRecordDtoSchemaRaw),
  assignedAbility: abilityCodeSchema.optional(),
  score: z.number().int(),
  applied: z.boolean().optional(),
  rolling: z.boolean().optional()
})
const characterManualRolledAbilityRecordDtoSchemaRaw = z.object({
  configuration: z.string().optional(),
  rollGroups: z.array(characterAbilityRollGroupRecordDtoSchemaRaw).optional(),
  assignments: z.array(characterManualAbilityAssignmentDtoSchemaRaw)
})
const characterStandardArrayAssignmentDtoSchemaRaw = z.object({
  ability: abilityCodeSchema,
  option: z.enum(['8', '10', '12', '13', '14', '15'])
})
const characterPointBuyAssignmentDtoSchemaRaw = z.object({
  ability: abilityCodeSchema,
  option: z.enum(['8', '9', '10', '11', '12', '13', '14', '15'])
})
const characterAbilityScoresIntentDtoSchemaRaw = z.union([
  z.object({
    method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY),
    assignments: z.array(characterStandardArrayAssignmentDtoSchemaRaw)
  }),
  z.object({
    method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY),
    assignments: z.array(characterPointBuyAssignmentDtoSchemaRaw)
  }),
  z.object({
    method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED),
    state: characterManualRolledAbilityRecordDtoSchemaRaw
  })
])
const characterStartingEquipmentSelectionDtoSchemaRaw = z.object({
  selectionKey: z.string(),
  equipmentId: z.string(),
  quantity: z.number().int()
})
const characterStartingEquipmentGroupSelectionDtoSchemaRaw = z.object({
  groupId: z.string(),
  optionId: z.string(),
  selections: z.array(characterStartingEquipmentSelectionDtoSchemaRaw).optional()
})
const characterStartingGoldSelectionDtoSchemaRaw = z.object({
  goldOption: z.string(),
  totalGold: z.number().int()
})
const characterStartingEquipmentDecisionDtoSchemaRaw = z.object({
  source: z.union([
    z.literal(CharacterStartingEquipmentSource.CLASS),
    z.literal(CharacterStartingEquipmentSource.BACKGROUND)
  ]),
  tookGold: z.boolean(),
  groups: z.array(characterStartingEquipmentGroupSelectionDtoSchemaRaw).optional(),
  gold: characterStartingGoldSelectionDtoSchemaRaw.optional(),
  applied: z.boolean().optional()
})
const characterSpellSelectionSourceDtoSchemaRaw = z.union([
  z.object({
    kind: z.literal('CLASS'),
    classId: z.string(),
    classLevel: z.number().int().optional()
  }),
  z.object({
    kind: z.literal('SUBCLASS'),
    subclassId: z.string(),
    classLevel: z.number().int().optional()
  }),
  z.object({ kind: z.literal('FEATURE'), featureId: z.string() }),
  z.object({ kind: z.literal('OPTION'), acquiredParentId: z.string(), optionId: z.string() })
])
const characterSpellSelectionRecordDtoSchemaRaw = z.object({
  id: z.string(),
  source: characterSpellSelectionSourceDtoSchemaRaw,
  timing: characterAcquisitionTimingDtoSchemaRaw,
  spells: z.array(z.string()),
  replacedSelectionId: z.string().optional()
})
const characterResourceGrantRecordDtoSchemaRaw = z.object({
  id: z.string(),
  resourceId: z.string(),
  source: characterSpellSelectionSourceDtoSchemaRaw,
  timing: characterAcquisitionTimingDtoSchemaRaw
})
const characterHitpointsIntentDtoSchemaRaw = z.object({
  method: z.union([
    z.literal(HITPOINT_CALCULATION_METHOD_CODE.FIXED),
    z.literal(HITPOINT_CALCULATION_METHOD_CODE.MANUAL)
  ]),
  levels: z.array(characterHitpointLevelEntryDtoSchemaRaw)
})
const characterIntentDtoSchemaRaw = z.object({
  advancement: characterAdvancementIntentDtoSchemaRaw,
  race: characterRaceIntentDtoSchemaRaw,
  ancestrySelections: z.array(characterAncestryAcquisitionDtoSchemaRaw).optional(),
  background: characterBackgroundIntentDtoSchemaRaw,
  classes: z.array(characterClassIntentDtoSchemaRaw),
  abilities: characterAbilityScoresIntentDtoSchemaRaw,
  hitpoints: characterHitpointsIntentDtoSchemaRaw,
  startingEquipment: z
    .object({
      class: characterStartingEquipmentDecisionDtoSchemaRaw.optional(),
      background: characterStartingEquipmentDecisionDtoSchemaRaw.optional()
    })
    .optional(),
  featureAcquisitions: z.array(characterFeatureAcquisitionRecordDtoSchemaRaw),
  chosenGrantSelections: characterChosenGrantSelectionsDtoSchemaRaw.optional(),
  spellSelections: z.array(characterSpellSelectionRecordDtoSchemaRaw).optional(),
  resourceGrants: z.array(characterResourceGrantRecordDtoSchemaRaw).optional()
})

export type CharacterProfileAuthoredDto = z.infer<typeof characterProfileAuthoredDtoSchemaRaw>
export type CharacterProvenanceDto = z.infer<typeof characterProvenanceDtoSchemaRaw>
export type CharacterAcquisitionTimingDto = z.infer<typeof characterAcquisitionTimingDtoSchemaRaw>
export type CharacterFeatureSelectionValueDto = z.infer<
  typeof characterFeatureSelectionValueDtoSchemaRaw
>
export type CharacterFeatureSelectionRecordDto = z.infer<
  typeof characterFeatureSelectionRecordDtoSchemaRaw
>
export type CharacterFeatureAcquisitionRecordDto = z.infer<
  typeof characterFeatureAcquisitionRecordDtoSchemaRaw
>
export type CharacterChosenGrantSelectionRecordDto = z.infer<
  typeof characterChosenGrantSelectionRecordDtoSchemaRaw
>
export type CharacterAdvancementIntentDto = z.infer<typeof characterAdvancementIntentDtoSchemaRaw>
export type CharacterDieRollRecordDto = z.infer<typeof characterDieRollRecordDtoSchemaRaw>
export type CharacterHitpointLevelEntryDto = z.infer<typeof characterHitpointLevelEntryDtoSchemaRaw>
export type CharacterRaceIntentDto = z.infer<typeof characterRaceIntentDtoSchemaRaw>
export type CharacterBackgroundIntentDto = z.infer<typeof characterBackgroundIntentDtoSchemaRaw>
export type CharacterAncestryAcquisitionDto = z.infer<
  typeof characterAncestryAcquisitionDtoSchemaRaw
>
export type CharacterClassIntentDto = z.infer<typeof characterClassIntentDtoSchemaRaw>
export type CharacterManualRolledAbilityRecordDto = z.infer<
  typeof characterManualRolledAbilityRecordDtoSchemaRaw
>
export type CharacterAbilityScoresIntentDto = z.infer<
  typeof characterAbilityScoresIntentDtoSchemaRaw
>
export type CharacterStartingEquipmentDecisionDto = z.infer<
  typeof characterStartingEquipmentDecisionDtoSchemaRaw
>
export type CharacterSpellSelectionRecordDto = z.infer<
  typeof characterSpellSelectionRecordDtoSchemaRaw
>
export type CharacterResourceGrantRecordDto = z.infer<
  typeof characterResourceGrantRecordDtoSchemaRaw
>
export type CharacterIntentDto = z.infer<typeof characterIntentDtoSchemaRaw>

export const characterProfileAuthoredDtoSchema = characterProfileAuthoredDtoSchemaRaw
export const characterProvenanceDtoSchema = characterProvenanceDtoSchemaRaw
export const characterAcquisitionTimingDtoSchema = characterAcquisitionTimingDtoSchemaRaw
export const characterFeatureSelectionValueDtoSchema = characterFeatureSelectionValueDtoSchemaRaw
export const characterFeatureSelectionRecordDtoSchema = characterFeatureSelectionRecordDtoSchemaRaw
export const characterFeatureAcquisitionRecordDtoSchema =
  characterFeatureAcquisitionRecordDtoSchemaRaw
export const characterChosenGrantSelectionRecordDtoSchema =
  characterChosenGrantSelectionRecordDtoSchemaRaw
export const characterAdvancementIntentDtoSchema = characterAdvancementIntentDtoSchemaRaw
export const characterDieRollRecordDtoSchema = characterDieRollRecordDtoSchemaRaw
export const characterHitpointLevelEntryDtoSchema = characterHitpointLevelEntryDtoSchemaRaw
export const characterRaceIntentDtoSchema = characterRaceIntentDtoSchemaRaw
export const characterBackgroundIntentDtoSchema = characterBackgroundIntentDtoSchemaRaw
export const characterAncestryAcquisitionDtoSchema = characterAncestryAcquisitionDtoSchemaRaw
export const characterClassIntentDtoSchema = characterClassIntentDtoSchemaRaw
export const characterManualRolledAbilityRecordDtoSchema =
  characterManualRolledAbilityRecordDtoSchemaRaw
export const characterAbilityScoresIntentDtoSchema = characterAbilityScoresIntentDtoSchemaRaw
export const characterStartingEquipmentDecisionDtoSchema =
  characterStartingEquipmentDecisionDtoSchemaRaw
export const characterSpellSelectionRecordDtoSchema = characterSpellSelectionRecordDtoSchemaRaw
export const characterResourceGrantRecordDtoSchema = characterResourceGrantRecordDtoSchemaRaw
export const characterIntentDtoSchema = characterIntentDtoSchemaRaw
