import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const steamMephit: CreatureAuthored = {
  id: S.CREATURE_IDS.STEAM_MEPHIT,
  label: 'Steam Mephit',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 5,
    DEXTERITY: 11,
    CONSTITUTION: 10,
    INTELLIGENCE: 11,
    WISDOM: 10,
    CHARISMA: 12,
    SPELLCASTING: 0
  },
  armorClass: 10,
  hitPoints: 21,
  hitDice: '6d6',
  speeds: [...S.walk(30), ...S.fly(30)],
  proficiencies: [
    S.grantedLanguageProficiency(262, 1, 'AQUAN', 'IGNAN')
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(262, 1),
      label: 'Death Burst',
      description: 'Death Burst. When the mephit dies, it explodes in a cloud of steam. Each creature within 5 feet of the mephit must succeed on a DC 10 Dexterity saving throw or take 4 (1d8) fire damage.',
      order: 1
    },
    {
      id: S.featureId(262, 2),
      label: 'Innate Spellcasting (1/Day)',
      description: 'Innate Spellcasting (1/Day). The mephit can innately cast blur, requiring no material components. Its innate spellcasting ability is Charisma.',
      order: 2
    },
    {
      id: S.featureId(262, 3),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +2 to hit, reach 5 ft., one creature. Hit: 2 (1d4) slashing damage plus 2 (1d4) fire damage.',
      capabilities: [
        {
          id: S.actionId(262, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(262, 2),
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
              id: S.actionId(262, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4'
            },
            {
              id: S.actionId(262, 4),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4'
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(262, 4),
      label: 'Steam Breath (Recharge 6)',
      description: 'Steam Breath (Recharge 6). The mephit exhales a 15-foot cone of scalding steam. Each creature in that area must succeed on a DC 10 Dexterity saving throw, taking 4 (1d8) fire damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(262, 5),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(262, 6),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.DEXTERITY
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(262, 7),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(262, 8),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8'
            },
            {
              id: S.actionId(262, 9),
              branch: S.BRANCH.ON_SAVE_SUCCESS,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              multiplier: 0.5
            }
          ]
        }
      ],
      order: 4
    }
  ],
  
}
