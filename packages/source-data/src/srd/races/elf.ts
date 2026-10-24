import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  SIZE_CODE,
  SPELL_GRANT_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, RACE_IDS, SUBRACE_IDS } from '../ids.js'
import {
  SRD_LANGUAGES,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_ELVEN_HERITAGE_ID,
  SRD_SKILLS
} from '../vocabulary.js'
import { srdSpells } from '../spells/index.js'
import { conditionSaveAdvantageGrants, magicConditionImmunityGrant } from '../classes/mechanics.js'
import { conditionTypeId } from '../spells/shared.js'

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

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId)
  throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

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

function availableLanguageIds(excludedCodes: string[] = []): string[] {
  const excluded = new Set(excludedCodes)
  return SRD_LANGUAGES.filter((language) => !excluded.has(language.code)).map(
    (language) => language.id
  )
}

const wizardCantripIds = srdSpells
  .filter((spell) => spell.level === 0 && spell.classIds.includes(CLASS_IDS.WIZARD))
  .map((spell) => spell.id)

// ─── Elf (raceIndex = 2) ──────────────────────────────────────────────────────

export const elf: RaceAuthored = {
  id: RACE_IDS.ELF,
  label: 'Elf',
  description:
    '<p>Your elf character has a variety of natural abilities, the result of thousands of years of elven refinement.</p>',
  category: RACE_CATEGORY_CODE.BASE,
  selectionMode: RACE_SELECTION_MODE.REQUIRES_SUBRACE,
  size: SIZE_CODE.MEDIUM,
  speeds: elfWalk30,
  heritageIds: [SRD_ELVEN_HERITAGE_ID],
  details: [
    {
      id: raceFeatureId(2, 0, 1),
      label: 'Age',
      description:
        'Although elves reach physical maturity at about the same age as humans, the elven understanding of adulthood goes beyond physical growth to encompass worldly experience. An elf typically claims adulthood and an adult name around the age of 100 and can live to be 750 years old.',
      order: 0
    },
    {
      id: raceFeatureId(2, 0, 2),
      label: 'Alignment',
      description:
        "Elves love freedom, variety, and self-expression, so they lean strongly toward the gentler aspects of chaos. They value and protect others' freedom as well as their own, and they are more often good than not.",
      order: 1
    },
    {
      id: raceFeatureId(2, 0, 3),
      label: 'Size',
      description:
        'Elves range from under 5 to over 6 feet tall and have slender builds. Your size is Medium.',
      order: 2
    },
    {
      id: raceFeatureId(2, 0, 4),
      label: 'Speed',
      description: 'Your base walking speed is 30 feet.',
      order: 3
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(2, 0, 5),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: 'Your Dexterity score increases by 2.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(2, 0, 6),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.DEXTERITY },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(2, 1, 1),
      label: 'Darkvision',
      description:
        "Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.",
      availableAtLevel: 1,
      order: 1,
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
              rangeKind: RANGE_KIND.DISTANCE,
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
      order: 2,
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
      description:
        "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
      availableAtLevel: 1,
      order: 3,
      grants: {
        modifiers: [
          ...conditionSaveAdvantageGrants(
            (entry) => raceFeatureId(2, 3, 2 + entry),
            conditionTypeId('CHARMED')
          ),
          magicConditionImmunityGrant(
            (entry) => raceFeatureId(2, 3, 8 + entry),
            conditionTypeId('UNCONSCIOUS'),
            6
          )
        ]
      }
    },
    {
      id: raceFeatureId(2, 4, 1),
      label: 'Trance',
      description:
        'Elves don\'t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day. (The Common word for such meditation is "trance.") While meditating, you can dream after a fashion; such dreams are actually mental exercises that have become reflexive through years of practice. After resting in this way, you gain the same benefit that a human does from 8 hours of sleep.',
      availableAtLevel: 1,
      order: 4
    },
    {
      id: raceFeatureId(2, 5, 1),
      label: 'Languages',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description:
        'You can speak, read, and write Common and Elvish. Elvish is fluid, with subtle intonations and intricate grammar.',
      availableAtLevel: 1,
      order: 5,
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
  description:
    '<p>As a high elf, you have a keen mind and a mastery of at least the basics of magic.</p>',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.ELF,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(103, 1, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: 'Your Intelligence score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(103, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.INTELLIGENCE },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 0
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
              equipId(36) // longbow
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(103, 3, 1),
      label: 'Cantrip',
      description:
        'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        spells: [
          {
            id: raceFeatureId(103, 3, 2),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: wizardCantripIds,
            attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN, SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: ABILITY_CODE.INTELLIGENCE,
            order: 0
          }
        ]
      }
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
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: availableLanguageIds(['COMMON', 'ELVISH']),
            order: 0
          }
        ]
      }
    }
  ]
}
