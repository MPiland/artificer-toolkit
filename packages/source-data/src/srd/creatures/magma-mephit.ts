import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const magmaMephit: CreatureAuthored = {
  id: S.CREATURE_IDS.MAGMA_MEPHIT,
  label: 'Magma Mephit',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 8,
    DEXTERITY: 12,
    CONSTITUTION: 12,
    INTELLIGENCE: 7,
    WISDOM: 10,
    CHARISMA: 10
  },
  naturalArmorBonus: 0,
  hitPoints: 22,
  details: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 5,
    die: 6,
    modifier: 5
  },
  speeds: [...S.walk(30), ...S.fly(30)],
  proficiencies: [
    S.grantedSkillProficiency(188, 1, 'STEALTH'),
    S.grantedLanguageProficiency(188, 2, 'IGNAN', 'TERRAN')
  ],
  damageVulnerabilities: ['cold'],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(188, 1),
      label: 'Death Burst',
      description:
        'Death Burst. When the mephit dies, it explodes in a burst of lava. Each creature within 5 feet of it must make a DC 11 Dexterity saving throw, taking 7 (2d6) fire damage on a failed save, or half as much damage on a successful one.',
      order: 1
    },
    {
      id: S.featureId(188, 2),
      label: 'False Appearance',
      description:
        'False Appearance. While the mephit remains motionless, it is indistinguishable from an ordinary mound of magma.',
      order: 2
    },
    {
      id: S.featureId(188, 3),
      label: 'Innate Spellcasting (1/Day)',
      description:
        'Innate Spellcasting (1/Day). The mephit can innately cast heat metal (spell save DC 10), requiring no material components. Its innate spellcasting ability is Charisma.',
      grants: {
        spells: [
          {
            id: S.actionId(188, 1301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.HEAT_METAL],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 10,
            charges: {
              id: S.actionId(188, 1302),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: 1
            },
            order: 1
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(188, 4),
      label: 'Claws',
      description:
        'Claws. Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 3 (1d4 + 1) slashing damage plus 2 (1d4) fire damage.',
      effects: [
        {
          id: S.actionId(188, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(188, 2),
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
              id: S.actionId(188, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(188, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(188, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4+1'
                  }
                ]
              }
            },
            {
              id: S.actionId(188, 4),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(188, 4) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(188, 4),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4'
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
      id: S.featureId(188, 5),
      ruleDefinitionIds: [S.DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(188, 5)),
      label: 'Fire Breath (Recharge 6)',
      description:
        'Fire Breath (Recharge 6). The mephit exhales a 15-foot cone of fire. Each creature in that area must make a DC 11 Dexterity saving throw, taking 7 (2d6) fire damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(188, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(188, 6),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 11
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfCone(S.actionId(188, 7), S.actionId(188, 1303), 15)
          },
          paths: [
            {
              id: S.actionId(188, 8),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(188, 8) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(188, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6'
                  }
                ]
              }
            },
            {
              id: S.actionId(188, 9),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(188, 9) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(188, 9),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
