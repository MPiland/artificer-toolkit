import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const lemure: CreatureAuthored = {
  id: S.CREATURE_IDS.LEMURE,
  label: 'Lemure',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 5,
    CONSTITUTION: 11,
    INTELLIGENCE: 1,
    WISDOM: 11,
    CHARISMA: 3
  },
  naturalArmorBonus: 0,
  hitPoints: 13,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 3,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(15)],
  damageResistances: ['cold'],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['charmed', 'frightened', 'poisoned'],
  senses: [S.darkvision(120)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(182, 1),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the lemure's darkvision.",
      order: 1
    },
    {
      id: S.featureId(182, 2),
      label: 'Hellish Rejuvenation',
      description:
        'Hellish Rejuvenation. A lemure that dies in the Nine Hells comes back to life with all its hit points in 1d10 days unless it is killed by a good-aligned creature with a bless spell cast on that creature or its remains are sprinkled with holy water.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(182, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(182, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Hellish Rejuvenation',
          reasonCode: 'EXTERNAL_WORLD_STATE',
          instructions:
            'A lemure that dies in the Nine Hells comes back to life with all its hit points in 1d10 days, unless a good-aligned creature with a bless spell cast on it killed the lemure or its remains are sprinkled with holy water.'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(182, 3),
      label: 'Language Limitation',
      description: "understands Infernal but can't speak",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(182, 1, 'INFERNAL')]
      },
      order: 3
    },
    {
      id: S.featureId(182, 4),
      label: 'Fist',
      description:
        'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(182, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(182, 2),
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
              id: S.actionId(182, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(182, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(182, 3),
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
      order: 4
    }
  ]
}
