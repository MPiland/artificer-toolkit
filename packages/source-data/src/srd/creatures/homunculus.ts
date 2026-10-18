import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const homunculus: CreatureAuthored = {
  id: S.CREATURE_IDS.HOMUNCULUS,
  label: 'Homunculus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 4,
    DEXTERITY: 15,
    CONSTITUTION: 11,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 7
  },
  naturalArmorBonus: 1,
  hitPoints: 5,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 2,
    die: 4,
    modifier: 0
  },
  speeds: [...S.walk(20), ...S.fly(40)],
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(166, 1),
      label: 'Telepathic Bond',
      description:
        'Telepathic Bond. While the homunculus is on the same plane of existence as its master, it can magically convey what it senses to its master, and the two can communicate telepathically.',
      order: 1
    },
    {
      id: S.featureId(166, 2),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 1 piercing damage, and the target must succeed on a DC 10 Constitution saving throw or be poisoned for 1 minute. If the saving throw fails by 5 or more, the target is instead poisoned for 5 (1d10) minutes and unconscious while poisoned in this way.',
      effects: [
        {
          id: S.actionId(166, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(166, 2),
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
              id: S.actionId(166, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(166, 9),
                resultKind: 'SEQUENCE' as const,
                // Poisoned for 1 minute (D62.2); the "fails by 5" unconsciousness stays description-only.
                duration: {
                  id: S.actionId(166, 8),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(166, 4),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.FIXED,
                    scalingKind: S.SCALING.NONE,
                    amount: 1
                  },
                  S.conditionSave({
                    id: S.actionId(166, 5),
                    savingThrowId: S.actionId(166, 6),
                    ability: 'CONSTITUTION',
                    dc: 10,
                    conditionOutcomeId: S.actionId(166, 7),
                    conditionId: conditionTypeId('POISONED'),
                    repeatsAtTurnEnd: false
                  })
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
