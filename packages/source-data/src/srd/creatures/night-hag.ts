import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'
export const nightHag: CreatureAuthored = {
  id: S.CREATURE_IDS.NIGHT_HAG,
  label: 'Night Hag',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 16,
    WISDOM: 14,
    CHARISMA: 16
  },
  naturalArmorBonus: 5,
  hitPoints: 112,
  details: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 15,
    die: 8,
    modifier: 45
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(4849, 1, 'DECEPTION', 'INSIGHT', 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(4849, 2, 'ABYSSAL', 'COMMON', 'INFERNAL', 'PRIMORDIAL')
  ],
  damageResistances: [
    "cold, fire; bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  conditionImmunities: ['charmed'],
  senses: [S.darkvision(120)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(204, 1),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The hag's innate spellcasting ability is Charisma (spell save DC 14, +6 to hit with spell attacks). She can innately cast the following spells, requiring no material components: At will: detect magic, magic missile 2/day each: plane shift (self only), ray of enfeeblement, sleep",
      grants: {
        spells: [
          {
            id: S.actionId(204, 701),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DETECT_MAGIC, S.SPELL_IDS.MAGIC_MISSILE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            order: 0
          },
          {
            id: S.actionId(204, 702),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.PLANE_SHIFT],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE, S.SPELL_GRANT_ATTRIBUTE.SELF_ONLY],
            charges: {
              id: S.actionId(204, 703),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 2
            },
            order: 1
          },
          {
            id: S.actionId(204, 704),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.RAY_OF_ENFEEBLEMENT, S.SPELL_IDS.SLEEP],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(204, 705),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 2
            },
            order: 2
          }
        ]
      },
      order: 1
    },
    {
      id: S.featureId(204, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The hag has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(204, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(204, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(204, 3),
      label: 'Claws (Hag Form Only)',
      description:
        'Claws. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(4849, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4849, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(4849, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4849, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(4849, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(4849, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(204, 4),
      label: 'Change Shape',
      description:
        "Change Shape. The hag magically polymorphs into a Small or Medium female humanoid, or back into her true form. Her statistics are the same in each form. Any equipment she is wearing or carrying isn't transformed. She reverts to her true form if she dies.",
      effects: [
        {
          id: S.actionId(4849, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4849, 6),
              rangeKind: S.RANGE_KIND.SELF
            }
          },
          paths: [
            {
              id: S.actionId(4849, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4849, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(4849, 7),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    ...CHANGE_SHAPE_RULING.SIZED_FORM
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(204, 5),
      label: 'Etherealness',
      description:
        'Etherealness. The hag magically enters the Ethereal Plane from the Material Plane, or vice versa. To do so, the hag must have a heartstone in her possession.',
      effects: [
        {
          id: S.actionId(4849, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4849, 9),
              rangeKind: S.RANGE_KIND.SELF
            }
          },
          paths: [
            {
              id: S.actionId(4849, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4849, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(4849, 10),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.NIGHT_HAG_ETHEREALNESS
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(204, 6),
      label: 'Nightmare Haunting (1/Day)',
      description:
        "Nightmare Haunting (1/Day). While on the Ethereal Plane, the hag magically touches a sleeping humanoid on the Material Plane. A protection from evil and good spell cast on the target prevents this contact, as does a magic circle. As long as the contact persists, the target has dreadful visions. If these visions last for at least 1 hour, the target gains no benefit from its rest, and its hit point maximum is reduced by 5 (1d10). If this effect reduces the target's hit point maximum to 0, the target dies, and if the target was evil, its soul is trapped in the hag's soul bag. The reduction to the target's hit point maximum lasts until removed by the greater restoration spell or similar magic.",
      effects: [
        {
          id: S.actionId(4849, 11),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4849, 12),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(4849, 13),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4849, 13) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(4849, 13),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Nightmare Haunting',
                    instructions:
                      'While the contact persists the target has dreadful visions. If the visions last at least 1 hour, the target gains no benefit from its rest and its hit point maximum is reduced by 5 (1d10); if that reduces it to 0, the target dies. The reduction lasts until removed by greater restoration or similar magic.',
                    reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
