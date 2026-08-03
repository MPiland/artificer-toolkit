import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CHARGE_RESET_KIND,
  CLOSED_RULE_KIND,
  type AbilityCode,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_RESOLUTION_KIND,
  CREATURE_CATEGORY_CODE,
  CREATURE_COMPANION_BOND_TYPE_CODE,
  CREATURE_INITIATIVE_MODE_CODE,
  CREATURE_MOUNT_TYPE_CODE,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  FOLLOW_UP_SAVE_TIMING,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SIZE_CODE,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  type CreatureAuthored,
  type FeatureAuthored
} from '@artificer-toolkit/shared'
import { CREATURE_IDS } from '../ids.js'
export { SPELL_IDS } from '../ids.js'
import {
  SRD_CHALLENGE_RATINGS,
  SRD_CREATURE_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_LANGUAGES,
  SRD_SKILLS,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

export { closedRuleEffect } from '../closed-rule-effect.js'

function vocabularyId<TCode extends string>(
  entries: readonly { code: TCode; id: string }[],
  code: TCode
): string {
  const entry = entries.find((item) => item.code === code)

  if (!entry) {
    throw new Error(`Missing SRD vocabulary ID for ${code}`)
  }

  return entry.id
}

export const CREATURE_TYPE = {
  ABERRATION: vocabularyId(SRD_CREATURE_TYPES, 'ABERRATION'),
  BEAST: vocabularyId(SRD_CREATURE_TYPES, 'BEAST'),
  CELESTIAL: vocabularyId(SRD_CREATURE_TYPES, 'CELESTIAL'),
  CONSTRUCT: vocabularyId(SRD_CREATURE_TYPES, 'CONSTRUCT'),
  DRAGON: vocabularyId(SRD_CREATURE_TYPES, 'DRAGON'),
  ELEMENTAL: vocabularyId(SRD_CREATURE_TYPES, 'ELEMENTAL'),
  FEY: vocabularyId(SRD_CREATURE_TYPES, 'FEY'),
  FIEND: vocabularyId(SRD_CREATURE_TYPES, 'FIEND'),
  GIANT: vocabularyId(SRD_CREATURE_TYPES, 'GIANT'),
  HUMANOID: vocabularyId(SRD_CREATURE_TYPES, 'HUMANOID'),
  MONSTROSITY: vocabularyId(SRD_CREATURE_TYPES, 'MONSTROSITY'),
  OOZE: vocabularyId(SRD_CREATURE_TYPES, 'OOZE'),
  PLANT: vocabularyId(SRD_CREATURE_TYPES, 'PLANT'),
  UNDEAD: vocabularyId(SRD_CREATURE_TYPES, 'UNDEAD')
} as const

export const CR = {
  CR_0: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_0'),
  CR_1_8: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1_8'),
  CR_1_4: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1_4'),
  CR_1_2: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1_2'),
  CR_1: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1'),
  CR_2: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_2'),
  CR_3: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_3'),
  CR_4: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_4'),
  CR_5: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_5'),
  CR_6: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_6'),
  CR_7: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_7'),
  CR_8: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_8'),
  CR_9: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_9'),
  CR_10: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_10'),
  CR_11: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_11'),
  CR_12: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_12'),
  CR_13: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_13'),
  CR_14: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_14'),
  CR_15: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_15'),
  CR_16: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_16'),
  CR_17: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_17'),
  CR_18: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_18'),
  CR_19: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_19'),
  CR_20: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_20'),
  CR_21: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_21'),
  CR_22: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_22'),
  CR_23: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_23'),
  CR_24: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_24'),
  CR_25: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_25'),
  CR_26: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_26'),
  CR_27: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_27'),
  CR_28: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_28'),
  CR_29: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_29'),
  CR_30: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_30')
} as const

const WALK_SPEED_ID = vocabularyId(SRD_SPEEDS, 'WALK')
const SWIM_SPEED_ID = vocabularyId(SRD_SPEEDS, 'SWIM')
const CLIMB_SPEED_ID = vocabularyId(SRD_SPEEDS, 'CLIMB')
const FLY_SPEED_ID = vocabularyId(SRD_SPEEDS, 'FLY')
const BURROW_SPEED_ID = vocabularyId(SRD_SPEEDS, 'BURROW')

function localId(group: number, creatureIndex: number, localIndex: number) {
  return `00000000-${group.toString(16).padStart(4, '0')}-${localIndex.toString(16).padStart(4, '0')}-0070-${creatureIndex.toString(16).padStart(4, '0')}00000000`
}

export function walk(amount: number) {
  return [{ speedId: WALK_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function climb(amount: number) {
  return [{ speedId: CLIMB_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function swim(amount: number) {
  return [{ speedId: SWIM_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function fly(amount: number) {
  return [{ speedId: FLY_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function burrow(amount: number) {
  return [{ speedId: BURROW_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function featureId(creatureIndex: number, localIndex: number) {
  return localId(1, creatureIndex, localIndex)
}

export function actionId(creatureIndex: number, localIndex: number) {
  return localId(2, creatureIndex, localIndex)
}

export function bonusActionId(creatureIndex: number, localIndex: number) {
  return localId(3, creatureIndex, localIndex)
}

export function reactionId(creatureIndex: number, localIndex: number) {
  return localId(4, creatureIndex, localIndex)
}

export function legendaryActionId(creatureIndex: number, localIndex: number) {
  return localId(5, creatureIndex, localIndex)
}

export function lairActionId(creatureIndex: number, localIndex: number) {
  return localId(6, creatureIndex, localIndex)
}

export function proficiencyId(creatureIndex: number, localIndex: number) {
  return localId(7, creatureIndex, localIndex)
}

export function skillId(code: string) {
  const entry = SRD_SKILLS.find((skill) => skill.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

export function languageId(code: string) {
  const entry = SRD_LANGUAGES.find((language) => language.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

export function damageTypeId(code: string) {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) throw new Error(`SRD damage type vocabulary entry for ${code} required.`)
  return entry.id
}

export function grantedSkillProficiency(
  creatureIndex: number,
  order: number,
  ...skillCodes: string[]
) {
  return {
    id: proficiencyId(creatureIndex, order),
    grantKind: GRANT_KIND.PROFICIENCY_GRANT,
    proficiencyKind: PROFICIENCY_KIND.SKILL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    level: SCALING_AMOUNT_KIND.FULL,
    skillIds: skillCodes.map(skillId),
    order
  }
}

export function grantedSaveProficiency(
  creatureIndex: number,
  order: number,
  ...abilities: AbilityCode[]
) {
  return {
    id: proficiencyId(creatureIndex, order),
    grantKind: GRANT_KIND.PROFICIENCY_GRANT,
    proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    level: SCALING_AMOUNT_KIND.FULL,
    abilities,
    order
  }
}

export function grantedLanguageProficiency(
  creatureIndex: number,
  order: number,
  ...languageCodes: string[]
) {
  return {
    id: proficiencyId(creatureIndex, order),
    grantKind: GRANT_KIND.PROFICIENCY_GRANT,
    proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    level: SCALING_AMOUNT_KIND.FULL,
    languageIds: languageCodes.map(languageId).sort(),
    order
  }
}

interface LegendaryActionOptionTemplate {
  label: string
  description: string
  order?: number
}

const dragonLegendaryActionOptions: LegendaryActionOptionTemplate[] = [
  {
    label: 'Detect',
    description: 'The dragon makes a Wisdom (Perception) check.'
  },
  {
    label: 'Tail Attack',
    description: 'The dragon makes a tail attack.'
  },
  {
    label: 'Wing Attack (Costs 2 Actions)',
    description:
      'The dragon beats its wings. Nearby creatures risk bludgeoning damage and being knocked prone, then the dragon can fly up to half its flying speed.'
  }
]

const dragonWingAttackDescriptionsByCreatureLabel: Record<string, string> = {
  'Adult Black Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Blue Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 20 Dexterity saving throw or take 14 (2d6 + 7) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Brass Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Bronze Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 20 Dexterity saving throw or take 14 (2d6 + 7) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Copper Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Gold Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Green Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Red Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Silver Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 21 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult White Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Black Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 23 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Blue Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 24 Dexterity saving throw or take 16 (2d6 + 9) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Brass Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Bronze Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 24 Dexterity saving throw or take 16 (2d6 + 9) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Copper Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 23 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Gold Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 25 Dexterity saving throw or take 17 (2d6 + 10) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Green Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 23 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Red Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 25 Dexterity saving throw or take 17 (2d6 + 10) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Silver Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 25 Dexterity saving throw or take 17 (2d6 + 10) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient White Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.'
}

const legendaryActionOptionsByCreatureLabel: Record<string, LegendaryActionOptionTemplate[]> = {
  Androsphinx: [
    {
      label: 'Claw Attack',
      description: 'The sphinx makes one claw attack.'
    },
    {
      label: 'Teleport (Costs 2 Actions)',
      description:
        'The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.'
    },
    {
      label: 'Cast a Spell (Costs 3 Actions)',
      description:
        'The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.'
    }
  ],
  Gynosphinx: [
    {
      label: 'Claw Attack',
      description: 'The sphinx makes one claw attack.'
    },
    {
      label: 'Teleport (Costs 2 Actions)',
      description:
        'The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.'
    },
    {
      label: 'Cast a Spell (Costs 3 Actions)',
      description:
        'The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.'
    }
  ],
  Lich: [
    {
      label: 'Cantrip',
      description: 'The lich casts a cantrip.'
    },
    {
      label: 'Paralyzing Touch (Costs 2 Actions)',
      description: 'The lich uses its Paralyzing Touch.'
    },
    {
      label: 'Frightening Gaze (Costs 2 Actions)',
      description:
        "The lich fixes its gaze on one creature it can see within 10 feet of it. The target must succeed on a DC 18 Wisdom saving throw against this magic or become frightened for 1 minute. The frightened target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a target's saving throw is successful or the effect ends for it, the target is immune to the lich's gaze for the next 24 hours."
    },
    {
      label: 'Disrupt Life (Costs 3 Actions)',
      description:
        'Each non-undead creature within 20 feet of the lich must make a DC 18 Constitution saving throw against this magic, taking 21 (6d6) necrotic damage on a failed save, or half as much damage on a successful one.'
    }
  ],
  'Mummy Lord': [
    {
      label: 'Attack',
      description:
        'The mummy lord makes one attack with its rotting fist or uses its Dreadful Glare.'
    },
    {
      label: 'Blinding Dust',
      description:
        "Blinding dust and sand swirls magically around the mummy lord. Each creature within 5 feet of the mummy lord must succeed on a DC 16 Constitution saving throw or be blinded until the end of the creature's next turn."
    },
    {
      label: 'Blasphemous Word (Costs 2 Actions)',
      description:
        "The mummy lord utters a blasphemous word. Each non-undead creature within 10 feet of the mummy lord that can hear the magical utterance must succeed on a DC 16 Constitution saving throw or be stunned until the end of the mummy lord's next turn."
    },
    {
      label: 'Channel Negative Energy (Costs 2 Actions)',
      description:
        "The mummy lord magically unleashes negative energy. Creatures within 60 feet of the mummy lord, including ones behind barriers and around corners, can't regain hit points until the end of the mummy lord's next turn."
    },
    {
      label: 'Whirlwind of Sand (Costs 2 Actions)',
      description:
        'The mummy lord magically transforms into a whirlwind of sand, moves up to 60 feet, and reverts to its normal form.'
    }
  ],
  Unicorn: [
    {
      label: 'Hooves',
      description: 'The unicorn makes one attack with its hooves.'
    },
    {
      label: 'Shimmering Shield (Costs 2 Actions)',
      description:
        "The unicorn creates a shimmering, magical field around itself or another creature it can see within 60 feet of it. The target gains a +2 bonus to AC until the end of the unicorn's next turn."
    },
    {
      label: 'Heal Self (Costs 3 Actions)',
      description: 'The unicorn magically regains 11 (2d8 + 2) hit points.'
    }
  ],
  Vampire: [
    {
      label: 'Move',
      description: 'The vampire moves up to its speed without provoking opportunity attacks.'
    },
    {
      label: 'Unarmed Strike',
      description: 'The vampire makes one unarmed strike.'
    },
    {
      label: 'Bite (Costs 2 Actions)',
      description: 'The vampire makes one bite attack.'
    }
  ]
}

export function normalizeLegendaryActionOptions<TCreature extends CreatureAuthored>(
  creature: TCreature
): TCreature {
  if (!creature.features?.some(isLegendaryActionFeature)) {
    return creature
  }

  let changed = false
  const features = creature.features.map((feature) => {
    if (!isLegendaryActionFeature(feature) || feature.options?.length) {
      return feature
    }

    const optionTemplates = getLegendaryActionOptionTemplates(creature.label)

    if (!optionTemplates.length) {
      return feature
    }

    changed = true
    return buildLegendaryActionFeatureWithOptions(feature, optionTemplates)
  })

  return changed ? { ...creature, features } : creature
}

function isLegendaryActionFeature(feature: FeatureAuthored): boolean {
  return feature.label.toLowerCase() === 'legendary actions'
}

function getLegendaryActionOptionTemplates(creatureLabel: string): LegendaryActionOptionTemplate[] {
  if (creatureLabel.endsWith('Dragon')) {
    const wingAttackDescription = dragonWingAttackDescriptionsByCreatureLabel[creatureLabel]

    return wingAttackDescription
      ? dragonLegendaryActionOptions.map((template) =>
          template.label === 'Wing Attack (Costs 2 Actions)'
            ? { ...template, description: wingAttackDescription }
            : template
        )
      : dragonLegendaryActionOptions
  }

  return legendaryActionOptionsByCreatureLabel[creatureLabel] ?? []
}

function buildLegendaryActionFeatureWithOptions(
  feature: FeatureAuthored,
  optionTemplates: LegendaryActionOptionTemplate[]
): FeatureAuthored {
  const effectsByOrder = new Map<number, NonNullable<FeatureAuthored['effects']>>()

  for (const effect of feature.effects ?? []) {
    effectsByOrder.set(effect.order, [...(effectsByOrder.get(effect.order) ?? []), effect])
  }

  const featureWithoutEffects = { ...feature }
  delete featureWithoutEffects.effects

  return {
    ...featureWithoutEffects,
    description: getLegendaryActionIntro(feature.description, optionTemplates),
    options: optionTemplates.map((template, index) => {
      const order = template.order ?? index + 1
      const optionEffects = effectsByOrder.get(order)

      return {
        id: legendaryActionOptionId(feature.id, order),
        label: template.label,
        description: template.description,
        order,
        ...(optionEffects?.length ? { effects: optionEffects } : {})
      }
    })
  }
}

function getLegendaryActionIntro(
  description: string,
  optionTemplates: LegendaryActionOptionTemplate[]
): string {
  const plainText = description
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^Legendary Actions\.\s*/, '')
  const firstOptionIndex = optionTemplates
    .map((template) => plainText.indexOf(`${template.label}.`))
    .filter((index) => index > 0)
    .sort((left, right) => left - right)[0]

  return firstOptionIndex ? plainText.slice(0, firstOptionIndex).trim() : plainText
}

function legendaryActionOptionId(featureId: string, order: number): string {
  const parts = featureId.split('-')
  const creatureIndex = Number.parseInt(parts[4]?.slice(0, 4) ?? '', 16)

  if (parts.length !== 5 || parts[3] !== '0070' || Number.isNaN(creatureIndex)) {
    throw new Error(`Cannot derive legendary action option ID from feature ID "${featureId}".`)
  }

  return localId(5, creatureIndex, 200 + order)
}

export {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_RESOLUTION_KIND,
  CHARGE_RESET_KIND,
  CLOSED_RULE_KIND,
  CREATURE_CATEGORY_CODE,
  CREATURE_COMPANION_BOND_TYPE_CODE,
  CREATURE_IDS,
  CREATURE_INITIATIVE_MODE_CODE,
  CREATURE_MOUNT_TYPE_CODE,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  FOLLOW_UP_SAVE_TIMING,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  SIZE_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER
}
