import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spider: CreatureAuthored = {
  id: S.CREATURE_IDS.SPIDER,
  label: 'Spider',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 2,
    DEXTERITY: 14,
    CONSTITUTION: 8,
    INTELLIGENCE: 1,
    WISDOM: 10,
    CHARISMA: 2,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 1,
  hitDice: '1d4 - 1',
  speeds: [...S.walk(20), ...S.climb(20)],
  proficiencies: [
    S.grantedSkillProficiency(258, 1, 'STEALTH')
  ],
  senses: ['darkvision 30 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(258, 1),
      label: 'Spider Climb',
      description: 'Spider Climb. The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      order: 1
    },
    {
      id: S.featureId(258, 2),
      label: 'Web Sense',
      description: 'Web Sense. While in contact with a web, the spider knows the exact location of any other creature in contact with the same web.',
      order: 2
    },
    {
      id: S.featureId(258, 3),
      label: 'Web Walker',
      description: 'Web Walker. The spider ignores movement restrictions caused by webbing.',
      order: 3
    },
    {
      id: S.featureId(258, 4),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 1 piercing damage, and the target must succeed on a DC 9 Constitution saving throw or take 2 (1d4) poison damage.',
      capabilities: [
        {
          id: S.actionId(258, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(258, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(258, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1'
            },
            {
              id: S.actionId(258, 4),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('POISON'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4',
            }
          ]
        }
      ],
      order: 4
    }
  ],
  
}
