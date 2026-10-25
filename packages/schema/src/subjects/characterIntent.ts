import { z, lazySchema } from '../zod.js'

import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  getCharacterChosenGrantSelectionIdentityKey
} from '@artificer-toolkit/shared/subjects/authored/character/intent'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const characterProfileAuthoredDtoSchemaRaw = lazySchema(() =>
  z.object({
    alignmentId: z.optional(z.string()),
    lifestyleId: z.optional(z.string()),
    faith: z.optional(z.string()),
    gender: z.optional(z.string()),
    age: z.optional(z.string()),
    eyes: z.optional(z.string()),
    hair: z.optional(z.string()),
    skin: z.optional(z.string()),
    height: z.optional(z.string()),
    weight: z.optional(z.string()),
    physicalCharacteristics: z.optional(z.string()),
    personalityTraits: z.optional(z.string()),
    ideals: z.optional(z.string()),
    bonds: z.optional(z.string()),
    flaws: z.optional(z.string()),
    organizations: z.optional(z.string()),
    allies: z.optional(z.string()),
    enemies: z.optional(z.string()),
    backstory: z.optional(z.string()),
    notes: z.optional(z.string())
  })
)
const characterProvenanceDtoSchemaRaw = lazySchema(() =>
  z.union([
    z.object({
      kind: z.literal('CLASS'),
      classId: z.string(),
      classLevel: z.optional(z.number().check(z.int()))
    }),
    z.object({
      kind: z.literal('SUBCLASS'),
      subclassId: z.string(),
      classLevel: z.optional(z.number().check(z.int()))
    }),
    z.object({ kind: z.literal('RACE'), raceId: z.string() }),
    z.object({ kind: z.literal('SUBRACE'), subraceId: z.string() }),
    z.object({ kind: z.literal('ANCESTRY'), ancestryId: z.string(), optionId: z.string() }),
    z.object({ kind: z.literal('BACKGROUND'), backgroundId: z.string() }),
    z.object({ kind: z.literal('FEAT'), featId: z.string() }),
    z.object({ kind: z.literal('FEATURE'), featureId: z.string() }),
    z.object({ kind: z.literal('OPTION'), acquiredParentId: z.string(), optionId: z.string() }),
    z.object({ kind: z.literal('MANUAL'), reason: z.optional(z.string()) })
  ])
)
const characterAcquisitionTimingDtoSchemaRaw = lazySchema(() =>
  z.union([
    z.object({ kind: z.literal('IMMEDIATE') }),
    z.object({ kind: z.literal('CHARACTER_LEVEL'), level: z.number().check(z.int()) }),
    z.object({
      kind: z.literal('CLASS_LEVEL'),
      classId: z.string(),
      classLevel: z.number().check(z.int())
    })
  ])
)
const characterFeatureSelectionValueDtoSchemaRaw = lazySchema(() =>
  z.union([
    z.object({ kind: z.literal('ID'), id: z.string() }),
    z.object({ kind: z.literal('IDS'), ids: z.array(z.string()) }),
    z.object({ kind: z.literal('NUMBER'), value: z.number() }),
    z.object({ kind: z.literal('BOOLEAN'), value: z.boolean() })
  ])
)
const characterFeatureSelectionRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    selectionKey: z.string(),
    values: z.array(characterFeatureSelectionValueDtoSchemaRaw)
  })
)
const characterFeatureAcquisitionRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    featureId: z.string(),
    source: characterProvenanceDtoSchemaRaw,
    timing: characterAcquisitionTimingDtoSchemaRaw,
    selections: z.optional(z.array(characterFeatureSelectionRecordDtoSchemaRaw))
  })
)
const characterChosenGrantSelectionRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    grantId: z.string(),
    source: characterProvenanceDtoSchemaRaw,
    timing: characterAcquisitionTimingDtoSchemaRaw,
    progressionLevel: z.optional(z.number().check(z.int()).check(z.positive())),
    targetIds: z.array(z.string())
  })
)
const characterChosenGrantSelectionsDtoSchemaRaw = lazySchema(() =>
  z.array(characterChosenGrantSelectionRecordDtoSchemaRaw).check(
    z.superRefine((selections, context) => {
      const seen = new Set<string>()
      selections.forEach((selection, index) => {
        const identity = getCharacterChosenGrantSelectionIdentityKey(selection)
        if (seen.has(identity))
          context.addIssue({
            code: 'custom',
            path: [index],
            message:
              'Chosen grant selections must be unique by grant, source, and progression level.'
          })
        seen.add(identity)
      })
    })
  )
)
const characterAdvancementIntentDtoSchemaRaw = lazySchema(() =>
  z.union([
    z.object({
      method: z.literal(ADVANCEMENT_METHOD_CODE.EXPERIENCE),
      experience: z.optional(z.number().check(z.int()))
    }),
    z.object({ method: z.literal(ADVANCEMENT_METHOD_CODE.MILESTONE) })
  ])
)
const characterDieRollRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    die: z.number().check(z.int()),
    value: z.number().check(z.int())
  })
)
const characterHitpointLevelEntryDtoSchemaRaw = lazySchema(() =>
  z.object({
    level: z.number().check(z.int()).check(z.positive()),
    classId: z.string().check(z.minLength(1)),
    classLevel: z.number().check(z.int()).check(z.positive()),
    value: z.number().check(z.int()),
    rolls: z.optional(z.array(characterDieRollRecordDtoSchemaRaw))
  })
)
const characterRaceIntentDtoSchemaRaw = lazySchema(() =>
  z.object({
    raceId: z.string(),
    subraceId: z.optional(z.string())
  })
)
const characterBackgroundIntentDtoSchemaRaw = lazySchema(() =>
  z.object({ backgroundId: z.string() })
)
const characterAncestryAcquisitionDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    ancestryId: z.string(),
    optionId: z.string(),
    source: z.union([
      z.object({ kind: z.literal('RACE'), raceId: z.string() }),
      z.object({ kind: z.literal('SUBRACE'), subraceId: z.string() })
    ]),
    timing: z.union([
      z.object({ kind: z.literal('IMMEDIATE') }),
      z.object({
        kind: z.literal('CLASS_LEVEL'),
        classId: z.string(),
        classLevel: z.number().check(z.int())
      })
    ])
  })
)
const characterClassIntentDtoSchemaRaw = lazySchema(() =>
  z.object({
    classId: z.string(),
    classLevel: z.number().check(z.int()),
    subclassId: z.optional(z.string()),
    specializationId: z.optional(z.string())
  })
)
const characterManualAbilityAssignmentDtoSchemaRaw = lazySchema(() =>
  z.object({
    ability: systemCoreCodeSchema,
    score: z.number().check(z.int())
  })
)
const characterAbilityRollGroupRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    rolls: z.array(characterDieRollRecordDtoSchemaRaw),
    kept: z.array(characterDieRollRecordDtoSchemaRaw),
    assignedAbility: z.optional(systemCoreCodeSchema),
    score: z.number().check(z.int()),
    applied: z.optional(z.boolean()),
    rolling: z.optional(z.boolean())
  })
)
const characterManualRolledAbilityRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    configuration: z.optional(z.string()),
    rollGroups: z.optional(z.array(characterAbilityRollGroupRecordDtoSchemaRaw)),
    assignments: z.array(characterManualAbilityAssignmentDtoSchemaRaw)
  })
)
const characterStandardArrayAssignmentDtoSchemaRaw = lazySchema(() =>
  z.object({
    ability: systemCoreCodeSchema,
    option: z.enum(['8', '10', '12', '13', '14', '15'])
  })
)
const characterPointBuyAssignmentDtoSchemaRaw = lazySchema(() =>
  z.object({
    ability: systemCoreCodeSchema,
    option: z.enum(['8', '9', '10', '11', '12', '13', '14', '15'])
  })
)
const characterAbilityScoresIntentDtoSchemaRaw = lazySchema(() =>
  z.union([
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
)
const characterStartingEquipmentSelectionDtoSchemaRaw = lazySchema(() =>
  z.object({
    selectionKey: z.string(),
    equipmentId: z.string(),
    quantity: z.number().check(z.int())
  })
)
const characterStartingEquipmentGroupSelectionDtoSchemaRaw = lazySchema(() =>
  z.object({
    groupId: z.string(),
    optionId: z.string(),
    selections: z.optional(z.array(characterStartingEquipmentSelectionDtoSchemaRaw))
  })
)
const characterStartingGoldSelectionDtoSchemaRaw = lazySchema(() =>
  z.object({
    goldOption: z.string(),
    totalGold: z.number().check(z.int())
  })
)
const characterStartingEquipmentDecisionDtoSchemaRaw = lazySchema(() =>
  z.object({
    source: z.union([
      z.literal(CharacterStartingEquipmentSource.CLASS),
      z.literal(CharacterStartingEquipmentSource.BACKGROUND)
    ]),
    tookGold: z.boolean(),
    groups: z.optional(z.array(characterStartingEquipmentGroupSelectionDtoSchemaRaw)),
    gold: z.optional(characterStartingGoldSelectionDtoSchemaRaw),
    applied: z.optional(z.boolean())
  })
)
const characterSpellSelectionSourceDtoSchemaRaw = lazySchema(() =>
  z.union([
    z.object({
      kind: z.literal('CLASS'),
      classId: z.string(),
      classLevel: z.optional(z.number().check(z.int()))
    }),
    z.object({
      kind: z.literal('SUBCLASS'),
      subclassId: z.string(),
      classLevel: z.optional(z.number().check(z.int()))
    }),
    z.object({ kind: z.literal('FEATURE'), featureId: z.string() }),
    z.object({ kind: z.literal('OPTION'), acquiredParentId: z.string(), optionId: z.string() })
  ])
)
const characterSpellSelectionRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    source: characterSpellSelectionSourceDtoSchemaRaw,
    timing: characterAcquisitionTimingDtoSchemaRaw,
    spells: z.array(z.string()),
    replacedSelectionId: z.optional(z.string())
  })
)
const characterResourceGrantRecordDtoSchemaRaw = lazySchema(() =>
  z.object({
    id: z.string(),
    resourceId: z.string(),
    source: characterSpellSelectionSourceDtoSchemaRaw,
    timing: characterAcquisitionTimingDtoSchemaRaw
  })
)
const characterHitpointsIntentDtoSchemaRaw = lazySchema(() =>
  z.object({
    method: z.union([
      z.literal(HITPOINT_CALCULATION_METHOD_CODE.FIXED),
      z.literal(HITPOINT_CALCULATION_METHOD_CODE.MANUAL)
    ]),
    levels: z.array(characterHitpointLevelEntryDtoSchemaRaw)
  })
)
const characterIntentDtoSchemaRaw = lazySchema(() =>
  z.object({
    advancement: characterAdvancementIntentDtoSchemaRaw,
    race: characterRaceIntentDtoSchemaRaw,
    ancestrySelections: z.optional(z.array(characterAncestryAcquisitionDtoSchemaRaw)),
    background: characterBackgroundIntentDtoSchemaRaw,
    classes: z.array(characterClassIntentDtoSchemaRaw),
    abilities: characterAbilityScoresIntentDtoSchemaRaw,
    hitpoints: characterHitpointsIntentDtoSchemaRaw,
    startingEquipment: z.optional(
      z.object({
        class: z.optional(characterStartingEquipmentDecisionDtoSchemaRaw),
        background: z.optional(characterStartingEquipmentDecisionDtoSchemaRaw)
      })
    ),
    featureAcquisitions: z.array(characterFeatureAcquisitionRecordDtoSchemaRaw),
    chosenGrantSelections: z.optional(characterChosenGrantSelectionsDtoSchemaRaw),
    spellSelections: z.optional(z.array(characterSpellSelectionRecordDtoSchemaRaw)),
    resourceGrants: z.optional(z.array(characterResourceGrantRecordDtoSchemaRaw))
  })
)

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
