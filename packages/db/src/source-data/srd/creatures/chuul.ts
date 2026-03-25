import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const chuul: CreatureAuthored = {
  id: S.CREATURE_IDS.CHUUL,
  label: 'Chuul',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ABERRATION,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 10,
    CONSTITUTION: 16,
    INTELLIGENCE: 5,
    WISDOM: 11,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 16,
  armorClassNote: 'natural armor',
  hitPoints: 93,
  hitDice: '11d10+33',
  speeds: [...S.walk(30), ...S.swim(30)],
  proficiencies: [
    S.grantedSkillProficiency(63, 1, 'PERCEPTION')
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(63, 1),
      label: 'Amphibious',
      description: 'Amphibious. The chuul can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(63, 2),
      label: 'Sense Magic',
      description: "Sense Magic. The chuul senses magic within 120 feet of it at will. This trait otherwise works like the detect magic spell but isn't itself magical.",
      order: 2
    },
    {
      id: S.featureId(63, 3),
      label: 'Language Limitation',
      description: 'Understands Deep Speech but can\'t speak.',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(63, 2, 'DEEP_SPEECH')
        ]
      },
      order: 3
    },
    {
      id: S.featureId(63, 4),
      label: 'Multiattack',
      description: 'Multiattack. The chuul makes two pincer attacks. If the chuul is grappling a creature, the chuul can also use its tentacles once.',
      order: 4
    },
    {
      id: S.featureId(63, 5),
      label: 'Pincer',
      description: "Pincer. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage. The target is grappled (escape DC 14) if it is a Large or smaller creature and the chuul doesn't have two other creatures grappled.",
      capabilities: [
        {
          id: S.actionId(63, 4),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(63, 5),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(63, 6),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6+4'
            },
            {
              id: S.actionId(63, 7),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.CONDITION,
              conditionId: conditionTypeId('GRAPPLED'),
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(63, 6),
      label: 'Tentacles',
      description: 'Tentacles. One creature grappled by the chuul must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute. Until this poison ends, the target is paralyzed. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      capabilities: [
        {
          id: S.actionId(63, 8),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(63, 11),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.CONSTITUTION
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(63, 9),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(63, 10),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.CONDITION,
              duration: {
                id: S.actionId(63, 12),
                durationKind: DURATION_KIND.MINUTE,
                amount: 1
              },
              conditionId: conditionTypeId('POISONED'),
            }
          ]
        }
      ],
      order: 6
    }
  ]
}

