import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLOSED_RULE_KIND,
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
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS, SUBRACE_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import {
  SRD_GNOMISH_HERITAGE_ID,
  SRD_LANGUAGES,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  SRD_DARKVISION_SENSE_ID
} from '../vocabulary.js'
import { raceClosedRuleEffect } from './closed-rule-effect.js'

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

function equipId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId)
  throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const gnomeWalk25 = [{ speedId: walkSpeedId, amount: 25, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Gnome (raceIndex = 6) ────────────────────────────────────────────────────

export const gnome: RaceAuthored = {
  id: RACE_IDS.GNOME,
  label: 'Gnome',
  description:
    '<p>Your gnome character has certain characteristics in common with all other gnomes.</p>',
  category: RACE_CATEGORY_CODE.BASE,
  selectionMode: RACE_SELECTION_MODE.REQUIRES_SUBRACE,
  size: SIZE_CODE.SMALL,
  speeds: gnomeWalk25,
  heritageIds: [SRD_GNOMISH_HERITAGE_ID],
  details: [
    {
      id: raceFeatureId(6, 0, 1),
      label: 'Age',
      description:
        'Gnomes mature at the same rate humans do, and most are expected to settle down into an adult life by around age 40. They can live 350 to almost 500 years.',
      order: 0
    },
    {
      id: raceFeatureId(6, 0, 2),
      label: 'Alignment',
      description:
        'Gnomes are most often good. Those who tend toward law are sages, engineers, researchers, scholars, investigators, or inventors. Those who tend toward chaos are minstrels, tricksters, wanderers, or fanciful jewelers.',
      order: 1
    },
    {
      id: raceFeatureId(6, 0, 3),
      label: 'Size',
      description:
        'Gnomes are between 3 and 4 feet tall and average about 40 pounds. Your size is Small.',
      order: 2
    },
    {
      id: raceFeatureId(6, 0, 4),
      label: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      order: 3
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(6, 1, 1),
      label: 'Darkvision',
      description:
        "Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.",
      availableAtLevel: 1,
      order: 0,
      grants: {
        senses: [
          {
            id: raceFeatureId(6, 1, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(6, 1, 3),
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
      id: raceFeatureId(6, 2, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: 'Your Intelligence score increases by 2.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(6, 2, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.INTELLIGENCE },
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
      id: raceFeatureId(6, 3, 1),
      label: 'Gnome Cunning',
      description:
        'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
      availableAtLevel: 1,
      order: 2,
      effects: [
        raceClosedRuleEffect(
          (entry) => raceFeatureId(6, 3, entry),
          CLOSED_RULE_KIND.RACE_GNOME_CUNNING
        )
      ]
    },
    {
      id: raceFeatureId(6, 4, 1),
      label: 'Languages',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description:
        'You can speak, read, and write Common and Gnomish. The Gnomish language, which uses the Dwarvish script, is renowned for its technical treatises and its catalogs of knowledge about the natural world.',
      availableAtLevel: 1,
      order: 3,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(6, 4, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('GNOMISH')],
            order: 0
          }
        ]
      }
    }
  ]
}

// ─── Rock Gnome (subraceIndex = 109) ─────────────────────────────────────────

export const rockGnome: RaceAuthored = {
  id: SUBRACE_IDS.ROCK_GNOME,
  label: 'Rock Gnome',
  description:
    '<p>As a rock gnome, you have a natural inventiveness and hardiness beyond that of other gnomes.</p>',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.GNOME,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(109, 1, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: 'Your Constitution score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(109, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CONSTITUTION },
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
      id: raceFeatureId(109, 2, 1),
      label: "Artificer's Lore",
      description:
        'Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: raceFeatureId(109, 3, 1),
      label: 'Tinker',
      description:
        "You have proficiency with artisan's tools (tinker's tools). Using those tools, you can spend 1 hour and 10 gp worth of materials to construct a Tiny clockwork device (AC 5, 1 hp). The device ceases to function after 24 hours (unless you spend 1 hour repairing it to keep the device functioning), or when you use your action to dismantle it; at that time, you can reclaim the materials used to create it. You can have up to three such devices active at a time. When you create a device, choose one of the following options: Clockwork Toy. This toy is a clockwork animal, monster, or person, such as a frog, mouse, bird, dragon, or soldier. When placed on the ground, the toy moves 5 feet across the ground on each of your turns in a random direction. It makes noises as appropriate to the creature it represents. Fire Starter. The device produces a miniature flame, which you can use to light a candle, torch, or campfire. Using the device requires your action. Music Box. When opened, this music box plays a single song at a moderate volume. The box stops playing when it reaches the song's end or when it is closed.",
      availableAtLevel: 1,
      order: 2,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(109, 3, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            equipmentIds: [equipId(65)],
            order: 0
          }
        ]
      }
    }
  ]
}
