import {
  SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS,
  ABILITY_CODE
} from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  EQUIPMENT_CATEGORY_CODE,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SUBCLASS_ATTRIBUTE,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_LANGUAGES, SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { closedRuleEffect, equippedCategoryRestriction } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((language) => language.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

const S = 10

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
const flySpeedId = SRD_SPEEDS.find((speed) => speed.code === 'FLY')?.id
if (!walkSpeedId || !flySpeedId) {
  throw new Error('SRD walk and fly speed vocabulary entries required.')
}

const DRACONIC_SPECIALIZATIONS = [
  {
    id: classRowId(S, 12, 1),
    label: 'Black Dragon',
    order: 1
  },
  {
    id: classRowId(S, 12, 2),
    label: 'Blue Dragon',
    order: 2
  },
  {
    id: classRowId(S, 12, 3),
    label: 'Brass Dragon',
    order: 3
  },
  {
    id: classRowId(S, 12, 4),
    label: 'Bronze Dragon',
    order: 4
  },
  {
    id: classRowId(S, 12, 5),
    label: 'Copper Dragon',
    order: 5
  },
  {
    id: classRowId(S, 12, 6),
    label: 'Gold Dragon',
    order: 6
  },
  {
    id: classRowId(S, 12, 7),
    label: 'Green Dragon',
    order: 7
  },
  {
    id: classRowId(S, 12, 8),
    label: 'Red Dragon',
    order: 8
  },
  {
    id: classRowId(S, 12, 9),
    label: 'Silver Dragon',
    order: 9
  },
  {
    id: classRowId(S, 12, 10),
    label: 'White Dragon',
    order: 10
  }
]

export const draconicBloodlineOrigin: ClassAuthored = {
  id: SUBCLASS_IDS.DRACONIC_BLOODLINE,
  label: 'Draconic Bloodline',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.SORCERER,
  description:
    'Your innate magic comes from draconic magic that was mingled with your blood or that of your ancestors. Most often, sorcerers with this origin trace their descent back to a mighty sorcerer of ancient times who made a bargain with a dragon or who might even have claimed a dragon parent. Some of these bloodlines are well established in the world, but most are obscure. Any given sorcerer could be the first of a new bloodline, as a result of a pact or some other exceptional circumstance.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  attributes: [SUBCLASS_ATTRIBUTE.SPECIALIZATION],
  specializations: DRACONIC_SPECIALIZATIONS.map(({ id, label, order }) => ({ id, label, order })),
  features: [
    {
      id: classRowId(S, 11, 1),
      label: 'Dragon Ancestor',
      description:
        'At 1st level, you choose one type of dragon as your ancestor. The damage type associated with each dragon is used by features you gain later. You can speak, read, and write Draconic. Additionally, whenever you make a Charisma check when interacting with dragons, your proficiency bonus is doubled if it applies to the check.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        proficiencies: [
          {
            id: classRowId(S, 11, 10),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('DRACONIC')],
            order: 0
          }
        ]
      },
      effects: [
        closedRuleEffect({
          id: classRowId(S, 20, 1),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(S, 21, 1), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_DRACONIC_BLOODLINE_DRAGON_ANCESTOR
        })
      ]
    },
    {
      id: classRowId(S, 11, 2),
      label: 'Draconic Resilience',
      description:
        "As magic flows through your body, it causes physical traits of your dragon ancestors to emerge. At 1st level, your hit point maximum increases by 1 and increases by 1 again whenever you gain a level in this class. Additionally, parts of your skin are covered by a thin sheen of dragon-like scales. When you aren't wearing armor, your AC equals 13 + your Dexterity modifier.",
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: classRowId(S, 12, 19),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.HIT_POINTS_MAX,
            domain: {},
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'CLASS_LEVEL', classId: CLASS_IDS.SORCERER, multiplier: 1 },
            order: 0
          },
          {
            id: classRowId(S, 12, 20),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
            domain: {},
            modifierKind: MODIFIER_KIND.SET_VALUE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { amount: 13, abilities: [ABILITY_CODE.DEXTERITY] },
            order: 1,
            // An alternative armor class formula without armor; a shield still adds.
            restrictions: equippedCategoryRestriction(
              (entry) => classRowId(S, 0x7a, 0x10 + entry),
              'EXCLUDE',
              [EQUIPMENT_CATEGORY_CODE.ARMOR]
            )
          }
        ]
      }
    },
    {
      id: classRowId(S, 11, 3),
      label: 'Elemental Affinity',
      description:
        'Starting at 6th level, when you cast a spell that deals damage of the type associated with your draconic ancestry, you can add your Charisma modifier to one damage roll of that spell. At the same time, you can spend 1 sorcery point to gain resistance to that damage type for 1 hour.',
      availableAtLevel: 6,
      order: 2,
      effects: [
        closedRuleEffect({
          id: classRowId(S, 20, 3),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(S, 21, 3), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_DRACONIC_BLOODLINE_ELEMENTAL_AFFINITY
        })
      ]
    },
    {
      id: classRowId(S, 11, 4),
      label: 'Dragon Wings',
      description:
        "At 14th level, you gain the ability to sprout a pair of dragon wings from your back, gaining a flying speed equal to your current speed. You can create these wings as a bonus action on your turn. They last until you dismiss them as a bonus action on your turn. You can't manifest your wings while wearing armor unless the armor is made to accommodate them, and clothing not made to accommodate your wings might be destroyed when you manifest them.",
      availableAtLevel: 14,
      order: 3,
      effects: [
        {
          id: classRowId(S, 20, 4),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
            range: { id: classRowId(S, 21, 4), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(S, 24, 1),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(S, 24, 2),
                resultKind: 'SINGLE',
                // The armor and clothing limits stay with the description.
                duration: {
                  id: classRowId(S, 0x8b, 1),
                  durationKind: DURATION_KIND.UNTIL_DISPELLED
                },
                outcomes: [
                  {
                    id: classRowId(S, 24, 3),
                    effectKind: EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: classRowId(S, 0x8a, 1),
                          grantKind: GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
                          domain: { speedId: flySpeedId },
                          modifierKind: MODIFIER_KIND.SET_VALUE,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { equalsSpeedId: walkSpeedId },
                          order: 1
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: classRowId(S, 11, 5),
      label: 'Draconic Presence',
      description:
        'Beginning at 18th level, you can channel the dread presence of your dragon ancestor, causing those around you to become awestruck or frightened. As an action, you can spend 5 sorcery points to draw on this power and exude an aura of awe or fear (your choice) to a distance of 60 feet. For 1 minute or until you lose your concentration (as if you were casting a concentration spell), each hostile creature that starts its turn in this aura must succeed on a Wisdom saving throw or be charmed (if you chose awe) or frightened (if you chose fear) until the aura ends. A creature that succeeds on this saving throw is immune to your aura for 24 hours.',
      availableAtLevel: 18,
      order: 4,
      effects: [
        {
          id: classRowId(S, 20, 5),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: classRowId(S, 25, 1),
              dcMethod: 'SOURCE_SAVE_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
            },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: classRowId(S, 21, 5),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 60,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: 'HOSTILE'
            }
          },
          paths: [
            {
              id: classRowId(S, 27, 5),
              order: 1,
              pathCode: PATH_CODE.ON_SAVE_FAIL,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(S, 27, 5)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(S, 29, 9),
                    effectKind: EFFECT_KIND.CLOSED_RULE,
                    ruleKind: CLOSED_RULE_KIND.CLASS_DRACONIC_BLOODLINE_DRACONIC_PRESENCE
                  }
                ]
              }
            },
            {
              id: classRowId(S, 28, 5),
              order: 2,
              pathCode: PATH_CODE.ON_SAVE_SUCCESS,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(S, 28, 5)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(S, 29, 10),
                    effectKind: EFFECT_KIND.CLOSED_RULE,
                    ruleKind: CLOSED_RULE_KIND.CLASS_DRACONIC_BLOODLINE_DRACONIC_PRESENCE
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
