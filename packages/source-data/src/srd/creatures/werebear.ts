import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import * as S from './shared.js'
export const werebear: CreatureAuthored = {
  id: S.CREATURE_IDS.WEREBEAR,
  label: 'Werebear',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000200000000',
  tags: ['human', 'shapechanger'],
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 10,
    CONSTITUTION: 17,
    INTELLIGENCE: 11,
    WISDOM: 12,
    CHARISMA: 12
  },
  naturalArmorBonus: 0,
  hitPoints: 135,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 18,
    die: 8,
    modifier: 54
  },
  speeds: [...S.walk(30)],
  damageImmunities: [
    'bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'
  ],
  proficiencies: [
    S.grantedLanguageProficiency(287, 2, 'COMMON'),
    S.grantedSkillExpertise(287, 1, 'PERCEPTION')
  ],
  passivePerception: 17,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(287, 1),
      label: 'Shapechanger',
      description:
        "Shapechanger. The werebear can use its action to polymorph into a Large bear-humanoid hybrid or into a Large bear, or back into its true form, which is humanoid. Its statistics, other than its size and AC, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(287, 200),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(287, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.LYCANTHROPE_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(287, 2),
      label: 'Keen Smell',
      description:
        'Keen Smell. The werebear has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 2
    },
    {
      id: S.featureId(287, 3),
      label: 'Multiattack',
      description:
        'Multiattack. In bear form, the werebear makes two claw attacks. In humanoid form, it makes two greataxe attacks. In hybrid form, it can attack like a bear or a humanoid.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(287, 5) }] }] },
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(287, 6) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(287, 4),
      label: 'Bite (Bear or Hybrid Form Only)',
      description:
        'Bite (Bear or Hybrid Form Only). Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 15 (2d10 + 4) piercing damage. If the target is a humanoid, it must succeed on a DC 14 Constitution saving throw or be cursed with werebear lycanthropy.',
      effects: [
        {
          id: S.actionId(287, 204),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(287, 205),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          order: 1,
          paths: [
            {
              id: S.actionId(287, 206),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(287, 207),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(287, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10+4'
                  },
                  {
                    id: S.actionId(287, 209),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_WEREBEAR_BITE
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
      id: S.featureId(287, 5),
      label: 'Claw (Bear or Hybrid Form Only)',
      description:
        'Claws. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(7539, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7539, 2),
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
              id: S.actionId(7539, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7539, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7539, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+4'
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
      id: S.featureId(287, 6),
      label: 'Greataxe (Humanoid or Hybrid Form Only)',
      description:
        'Greataxe (Humanoid or Hybrid Form Only). Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 10 (1d12 + 4) slashing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 287,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'SLASHING',
          diceConfig: '1d12',
          ability: 'STRENGTH'
        })
      ],
      order: 6
    }
  ]
}
