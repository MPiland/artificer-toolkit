import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const iceMephit: CreatureAuthored = {
  id: S.CREATURE_IDS.ICE_MEPHIT,
  label: 'Ice Mephit',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 7,
    DEXTERITY: 13,
    CONSTITUTION: 10,
    INTELLIGENCE: 9,
    WISDOM: 11,
    CHARISMA: 12,
    SPELLCASTING: 0
  },
  armorClass: 11,
  hitPoints: 21,
  hitDice: '6d6',
  speeds: [...S.walk(30), ...S.fly(30)],
  proficiencies: [
    S.grantedSkillProficiency(172, 1, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(172, 2, 'AQUAN', 'AURAN')
  ],
  damageVulnerabilities: ['bludgeoning', 'fire'],
  damageImmunities: ['cold', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(172, 1),
      label: 'Death Burst',
      description: 'Death Burst. When the mephit dies, it explodes in a burst of jagged ice. Each creature within 5 feet of it must make a DC 10 Dexterity saving throw, taking 4 (1d8) slashing damage on a failed save, or half as much damage on a successful one.',
      order: 1
    },
    {
      id: S.featureId(172, 2),
      label: 'False Appearance',
      description: 'False Appearance. While the mephit remains motionless, it is indistinguishable from an ordinary shard of ice.',
      order: 2
    },
    {
      id: S.featureId(172, 3),
      label: 'Innate Spellcasting (1/Day)',
      description: 'Innate Spellcasting (1/Day). The mephit can innately cast fog cloud, requiring no material components. Its innate spellcasting ability is Charisma.',
      order: 3
    },
    {
      id: S.featureId(172, 4),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 3 (1d4 + 1) slashing damage plus 2 (1d4) cold damage.',
      capabilities: [
        {
          id: S.actionId(172, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(172, 2),
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
              id: S.actionId(172, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4+1'
            },
            {
              id: S.actionId(172, 4),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('COLD'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4'
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(172, 5),
      label: 'Frost Breath (Recharge 6)',
      description: 'Frost Breath (Recharge 6). The mephit exhales a 15-foot cone of cold air. Each creature in that area must succeed on a DC 10 Dexterity saving throw, taking 5 (2d4) cold damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(172, 5),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(172, 6),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.DEXTERITY
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(172, 7),
              rangeKind: S.RANGE_KIND.SPECIAL
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS
            }
          },
          branches: [
            {
              id: S.actionId(172, 8),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('COLD'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d4'
            },
            {
              id: S.actionId(172, 9),
              branch: S.BRANCH.ON_SAVE_SUCCESS,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('COLD'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d4',
              multiplier: 0.5
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
