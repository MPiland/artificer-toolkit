import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const acolyte: CreatureAuthored = {
  id: S.CREATURE_IDS.ACOLYTE,
  label: 'Acolyte',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 14,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 9,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 2,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedSkillProficiency(2, 1, 'MEDICINE', 'RELIGION')],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(2, 1),
      label: 'Spellcasting',
      description:
        'Spellcasting. The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks). The acolyte has following cleric spells prepared: Cantrips (at will): light, sacred flame, thaumaturgy 1st level (3 slots): bless, cure wounds, sanctuary',
      grants: {
        spells: [
          {
            id: S.featureId(2, 101),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.LIGHT, S.SPELL_IDS.SACRED_FLAME, S.SPELL_IDS.THAUMATURGY],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.WISDOM,
            spellSaveDc: 12,
            order: 0
          },
          {
            id: S.featureId(2, 102),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.BLESS, S.SPELL_IDS.CURE_WOUNDS, S.SPELL_IDS.SANCTUARY],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.PREPARED,
              S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: 1,
            castingAbility: S.ABILITY_CODE.WISDOM,
            spellSaveDc: 12,
            charges: {
              id: S.featureId(2, 103),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: 3
            },
            order: 1
          }
        ]
      },
      order: 1
    },
    {
      id: S.featureId(2, 2),
      label: 'Language Knowledge',
      description: 'any one language (usually Common)',
      grants: {
        proficiencies: [S.grantedLanguageProficiency(2, 2, 'COMMON')]
      },
      order: 2
    },
    {
      id: S.featureId(2, 3),
      label: 'Club',
      description:
        'Club. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(2, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2, 2),
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
              id: S.actionId(2, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(2, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
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
      order: 3
    }
  ]
}
