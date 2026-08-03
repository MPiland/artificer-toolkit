import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { closedRuleEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const P = 7

const devotionOathSpellLevels = [
  { level: 3, spellIds: [SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, SPELL_IDS.SANCTUARY] },
  { level: 5, spellIds: [SPELL_IDS.LESSER_RESTORATION, SPELL_IDS.ZONE_OF_TRUTH] },
  { level: 9, spellIds: [SPELL_IDS.BEACON_OF_HOPE, SPELL_IDS.DISPEL_MAGIC] },
  { level: 13, spellIds: [SPELL_IDS.FREEDOM_OF_MOVEMENT, SPELL_IDS.GUARDIAN_OF_FAITH] },
  { level: 17, spellIds: [SPELL_IDS.COMMUNE, SPELL_IDS.FLAME_STRIKE] }
]

export const oathOfDevotion: ClassAuthored = {
  id: SUBCLASS_IDS.DEVOTION,
  label: 'Oath of Devotion',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.PALADIN,
  description:
    "The Oath of Devotion binds a paladin to the loftiest ideals of justice, virtue, and order. Sometimes called cavaliers, white knights, or holy warriors, these paladins meet the ideal of the knight in shining armor, acting with honor in pursuit of justice and the greater good. They hold themselves to the highest standards of conduct, and some, for better or worse, hold the rest of the world to the same standards. Many who swear this oath are devoted to gods of law and good and use their gods' tenets as the measure of their devotion. They hold angels—the perfect servants of good—as their ideals, and incorporate images of angelic wings into their helmets or coats of arms.",
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(P, 11, 1),
      label: 'Oath Spells',
      description: 'You gain oath spells at the paladin levels listed.',
      availableAtLevel: 3,
      order: 0,
      grants: {
        spells: [
          {
            id: classRowId(P, 11, 10),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
              scalingSource: SCALING_SOURCE.PARENT_CLASS_LEVEL,
              levels: devotionOathSpellLevels.map((spellLevel, index) => ({
                id: classRowId(P, 16, index + 1),
                level: spellLevel.level,
                order: index + 1,
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                spellIds: spellLevel.spellIds
              }))
            },
            attributes: [SPELL_GRANT_ATTRIBUTE.PREPARED],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(P, 11, 2),
      label: 'Channel Divinity: Sacred Weapon',
      description:
        'As an action, you can imbue one weapon that you are holding with positive energy, using your Channel Divinity. For 1 minute, you add your Charisma modifier to attack rolls made with that weapon (with a minimum bonus of +1). The weapon also emits bright light in a 20-foot radius and dim light 20 feet beyond that. If the weapon is not already magical, it becomes magical for the duration. You can end this effect on your turn as part of any other action. If you are no longer holding or carrying this weapon, or if you fall unconscious, this effect ends.',
      availableAtLevel: 3,
      order: 1,
      effects: [
        closedRuleEffect({
          id: classRowId(P, 20, 1),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: classRowId(P, 21, 1), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_OATH_OF_DEVOTION_SACRED_WEAPON
        })
      ]
    },
    {
      id: classRowId(P, 11, 3),
      label: 'Channel Divinity: Turn the Unholy',
      description:
        "As an action, you present your holy symbol and speak a prayer censuring fiends and undead, using your Channel Divinity. Each fiend or undead that can see or hear you within 30 feet of you must make a Wisdom saving throw. If the creature fails its saving throw, it is turned for 1 minute or until it takes damage. A turned creature must spend its turns trying to move as far away from you as it can, and it can't willingly move to a space within 30 feet of you. It also can't take reactions. For its action, it can use only the Dash action or try to escape from an effect that prevents it from moving. If there's nowhere to move, the creature can use the Dodge action.",
      availableAtLevel: 3,
      order: 2,
      effects: [
        {
          id: classRowId(P, 20, 2),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: classRowId(P, 25, 1),
              dcMethod: 'SOURCE_SAVE_DC',
              ability: ABILITY_CODE.WISDOM
            },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: classRowId(P, 21, 2),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 30,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: 'ANY'
            }
          },
          paths: [
            {
              id: classRowId(P, 27, 2),
              order: 1,
              pathCode: PATH_CODE.ON_SAVE_FAIL,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(P, 27, 2)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(P, 29, 3),
                    effectKind: EFFECT_KIND.CLOSED_RULE,
                    ruleKind: CLOSED_RULE_KIND.CLASS_OATH_OF_DEVOTION_TURN_THE_UNHOLY
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: classRowId(P, 11, 4),
      label: 'Aura of Devotion',
      description:
        "Starting at 7th level, you and friendly creatures within 10 feet of you can't be charmed while you are conscious. At 18th level, the range of this aura increases to 30 feet.",
      availableAtLevel: 7,
      order: 3,
      effects: [
        closedRuleEffect({
          id: classRowId(P, 20, 3),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: {
              id: classRowId(P, 21, 3),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 10,
              unit: MEASUREMENT_UNIT_CODE.FEET,
              scaling: {
                scalingKind: 'BREAKPOINTS',
                scalingSource: SCALING_SOURCE.PARENT_CLASS_LEVEL,
                breakpoints: [
                  {
                    id: classRowId(P, 30, 1),
                    level: 7,
                    order: 1,
                    value: { amount: 10, unit: MEASUREMENT_UNIT_CODE.FEET }
                  },
                  {
                    id: classRowId(P, 30, 2),
                    level: 18,
                    order: 2,
                    value: { amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }
                  }
                ]
              }
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: 'WILLING'
            }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_OATH_OF_DEVOTION_AURA_OF_DEVOTION
        })
      ]
    },
    {
      id: classRowId(P, 11, 5),
      label: 'Purity of Spirit',
      description:
        'Beginning at 15th level, you are always under the effects of a protection from evil and good spell.',
      availableAtLevel: 15,
      order: 4,
      effects: [
        closedRuleEffect({
          id: classRowId(P, 20, 4),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(P, 21, 4), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.PROTECTION_FROM_EVIL_AND_GOOD
        })
      ]
    },
    {
      id: classRowId(P, 11, 6),
      label: 'Holy Nimbus',
      description:
        'At 20th level, as an action, you can emanate an aura of sunlight. For 1 minute, bright light shines from you in a 30-foot radius, and dim light shines 30 feet beyond that. Whenever an enemy creature starts its turn in the bright light, the creature takes 10 radiant damage. In addition, for the duration, you have advantage on saving throws against spells cast by fiends or undead.',
      availableAtLevel: 20,
      order: 5,
      attributes: ['LIMITED_USE'],
      charges: {
        id: classRowId(P, 22, 1),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'LONG_REST',
        amount: 1
      },
      effects: [
        closedRuleEffect({
          id: classRowId(P, 20, 5),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: classRowId(P, 21, 5),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 30,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: 'HOSTILE'
            }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_OATH_OF_DEVOTION_HOLY_NIMBUS
        })
      ]
    }
  ]
}
