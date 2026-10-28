import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'
import * as S from './shared.js'

export const druid: CreatureAuthored = {
  id: CREATURE_IDS.DRUID,
  label: 'Druid',
  description: 'Medium humanoid (any race), any alignment',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 12,
    CONSTITUTION: 13,
    INTELLIGENCE: 12,
    WISDOM: 15,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 27,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 5,
    die: 8,
    modifier: 5
  },
  speeds: walk(30),
  proficiencies: [
    S.grantedSkillProficiency(89, 1, 'MEDICINE', 'NATURE', 'PERCEPTION'),
    S.grantedLanguageProficiency(89, 2, 'DRUIDIC')
  ],
  passivePerception: 14,
  challengeRatingId: CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(89, 1),
      label: 'Spellcasting',
      description:
        'Spellcasting. The druid is a 4th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks). It has the following druid spells prepared: Cantrips (at will): druidcraft, produce flame, shillelagh 1st level (4 slots): entangle, longstrider, speak with animals, thunderwave 2nd level (3 slots): animal messenger, barkskin',
      grants: S.slottedSpellcastingGrants(
        89,
        S.ABILITY_CODE.WISDOM,
        12,
        [S.SPELL_IDS.DRUIDCRAFT, S.SPELL_IDS.PRODUCE_FLAME, S.SPELL_IDS.SHILLELAGH],
        [
          {
            level: 1,
            slots: 4,
            spellIds: [
              S.SPELL_IDS.ENTANGLE,
              S.SPELL_IDS.LONGSTRIDER,
              S.SPELL_IDS.SPEAK_WITH_ANIMALS,
              S.SPELL_IDS.THUNDERWAVE
            ]
          },
          { level: 2, slots: 3, spellIds: [S.SPELL_IDS.ANIMAL_MESSENGER, S.SPELL_IDS.BARKSKIN] }
        ]
      ),
      order: 1
    },
    {
      id: S.featureId(89, 2),
      label: 'Quarterstaff',
      description:
        'Quarterstaff. Melee Weapon Attack: +2 to hit (+4 to hit with shillelagh), reach 5 ft., one target. Hit: 3 (1d6) bludgeoning damage, 4 (1d8) bludgeoning damage if wielded with two hands, or 6 (1d8 + 2) bludgeoning damage with shillelagh.',
      effects: [
        {
          id: S.actionId(89, 204),
          order: 1,
          grip: 'ONE_HANDED' as const,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(89, 1202),
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
              id: S.actionId(89, 205),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(89, 206),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(89, 207),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6'
                  }
                ]
              }
            }
          ]
        },
        // Shillelagh (+4 to hit, 1d8 + 2) is the druid's spell and stays description-only.
        {
          id: S.actionId(89, 208),
          order: 2,
          grip: 'TWO_HANDED' as const,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(89, 1203),
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
              id: S.actionId(89, 209),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(89, 210),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(89, 211),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
