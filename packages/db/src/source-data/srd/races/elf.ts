import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  RACE_CATEGORY_CODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  SIZE_CODE,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS, SUBRACE_IDS, SPELL_IDS } from '../ids.js'
import { SRD_LANGUAGES, SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID, SRD_DARKVISION_SENSE_ID, SRD_SKILLS, SRD_CONDITION_TYPES } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

function equipId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}

function conditionTypeId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((c) => c.code === code)
  if (!entry) throw new Error(`SRD condition type vocabulary entry for ${code} required.`)
  return entry.id
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const elfWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

// ─── Elf (raceIndex = 2) ──────────────────────────────────────────────────────

export const elf: RaceAuthored = {
  id: RACE_IDS.ELF,
  label: 'Elf',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.MEDIUM,
  speeds: elfWalk30,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(2, 1, 1),
      label: 'Darkvision',
      description: 'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        senses: [
          {
            id: raceFeatureId(2, 1, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(2, 1, 3),
              rangeKind: 'DISTANCE' as const,
              amount: 60,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(2, 2, 1),
      label: 'Keen Senses',
      description: 'You have proficiency in the Perception skill.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(2, 2, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SKILL,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            skillIds: [skillId('PERCEPTION')],
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(2, 3, 1),
      label: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(2, 3, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_BONUS,
            domain: {
              ability: ABILITY_CODE.CHARISMA,
              conditionTypeId: conditionTypeId('CHARMED')
            },
            modifierKind: MODIFIER_KIND.ADVANTAGE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: undefined,
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(2, 4, 1),
      label: 'Trance',
      description: 'Elves don\'t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day. After resting in this way, you gain the same benefit that a human does from 8 hours of sleep.',
      availableAtLevel: 1,
      order: 3
    },
    {
      id: raceFeatureId(2, 5, 1),
      label: 'Languages',
      description: 'You can speak, read, and write Common and Elvish.',
      availableAtLevel: 1,
      order: 4,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(2, 5, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('ELVISH')],
            order: 0
          }
        ]
      }
    }
  ]
}

// ─── High Elf (subraceIndex = 103) ────────────────────────────────────────────

export const highElf: RaceAuthored = {
  id: SUBRACE_IDS.HIGH_ELF,
  label: 'High Elf',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.ELF,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(103, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2, and your Intelligence score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(103, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.DEXTERITY },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          },
          {
            id: raceFeatureId(103, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.INTELLIGENCE },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 1
          }
        ]
      }
    },
    {
      id: raceFeatureId(103, 2, 1),
      label: 'Elf Weapon Training',
      description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(103, 2, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            equipmentIds: [
              equipId(22), // longsword
              equipId(28), // shortsword
              equipId(13), // shortbow
              equipId(36)  // longbow
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(103, 3, 1),
      label: 'Cantrip',
      description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
      availableAtLevel: 1,
      order: 2
    },
    {
      id: raceFeatureId(103, 4, 1),
      label: 'Extra Language',
      description: 'You can speak, read, and write one extra language of your choice.',
      availableAtLevel: 1,
      order: 3,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(103, 4, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.ALL,
            order: 0
          }
        ]
      }
    }
  ]
}

// ─── Wood Elf (subraceIndex = 104) ────────────────────────────────────────────

export const woodElf: RaceAuthored = {
  id: SUBRACE_IDS.WOOD_ELF,
  label: 'Wood Elf',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.ELF,
  speeds: [{ speedId: walkSpeedId, amount: 35, unit: MEASUREMENT_UNIT_CODE.FEET }],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(104, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2, and your Wisdom score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(104, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.DEXTERITY },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          },
          {
            id: raceFeatureId(104, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.WISDOM },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 1
          }
        ]
      }
    },
    {
      id: raceFeatureId(104, 2, 1),
      label: 'Elf Weapon Training',
      description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(104, 2, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            equipmentIds: [
              equipId(22), // longsword
              equipId(28), // shortsword
              equipId(13), // shortbow
              equipId(36)  // longbow
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(104, 3, 1),
      label: 'Fleet of Foot',
      description: 'Your base walking speed increases to 35 feet.',
      availableAtLevel: 1,
      order: 2
    },
    {
      id: raceFeatureId(104, 4, 1),
      label: 'Mask of the Wild',
      description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
      availableAtLevel: 1,
      order: 3
    },
    {
      id: raceFeatureId(104, 5, 1),
      label: 'Languages',
      description: 'You can speak, read, and write Common and Elvish.',
      availableAtLevel: 1,
      order: 4,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(104, 5, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('ELVISH')],
            order: 0
          }
        ]
      }
    }
  ]
}

// ─── Dark Elf / Drow (subraceIndex = 105) ─────────────────────────────────────

export const darkElf: RaceAuthored = {
  id: SUBRACE_IDS.DARK_ELF,
  label: 'Dark Elf (Drow)',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.ELF,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(105, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2, and your Charisma score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(105, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.DEXTERITY },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          },
          {
            id: raceFeatureId(105, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CHARISMA },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 1
          }
        ]
      }
    },
    {
      id: raceFeatureId(105, 2, 1),
      label: 'Superior Darkvision',
      description: 'Your darkvision has a radius of 120 feet.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        senses: [
          {
            id: raceFeatureId(105, 2, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(105, 2, 3),
              rangeKind: 'DISTANCE' as const,
              amount: 120,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(105, 3, 1),
      label: 'Sunlight Sensitivity',
      description: 'You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.',
      availableAtLevel: 1,
      order: 2
    },
    {
      id: raceFeatureId(105, 4, 1),
      label: 'Drow Magic',
      description: 'You know the Dancing Lights cantrip. When you reach 3rd level, you can cast the Faerie Fire spell once per day. When you reach 5th level, you can also cast the Darkness spell once per day. Charisma is your spellcasting ability for these spells.',
      availableAtLevel: 1,
      order: 3,
      grants: {
        spells: [
          {
            id: raceFeatureId(105, 4, 2),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: [SPELL_IDS.DANCING_LIGHTS],
            order: 0
          },
          {
            id: raceFeatureId(105, 4, 3),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: [SPELL_IDS.FAERIE_FIRE],
            order: 1
          },
          {
            id: raceFeatureId(105, 4, 4),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: [SPELL_IDS.DARKNESS],
            order: 2
          }
        ]
      }
    },
    {
      id: raceFeatureId(105, 5, 1),
      label: 'Drow Weapon Training',
      description: 'You have proficiency with rapiers, shortswords, and hand crossbows.',
      availableAtLevel: 1,
      order: 4,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(105, 5, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            equipmentIds: [
              equipId(26), // rapier
              equipId(28), // shortsword
              equipId(34)  // hand crossbow
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(105, 6, 1),
      label: 'Languages',
      description: 'You can speak, read, and write Common, Elvish, and Undercommon.',
      availableAtLevel: 1,
      order: 5,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(105, 6, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('ELVISH'), languageId('UNDERCOMMON')],
            order: 0
          }
        ]
      }
    }
  ]
}
