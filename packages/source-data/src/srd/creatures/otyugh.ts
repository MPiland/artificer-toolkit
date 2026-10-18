import { type CreatureAuthored } from '@artificer-toolkit/shared'

import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const otyugh: CreatureAuthored = {
  id: S.CREATURE_IDS.OTYUGH,
  label: 'Otyugh',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ABERRATION,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 11,
    CONSTITUTION: 19,
    INTELLIGENCE: 6,
    WISDOM: 13,
    CHARISMA: 6
  },
  naturalArmorBonus: 4,
  hitPoints: 114,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 12,
    die: 10,
    modifier: 48
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(213, 1, 'CONSTITUTION'),
    S.grantedLanguageProficiency(213, 2, 'OTYUGH')
  ],
  senses: [S.darkvision(120)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(213, 1),
      label: 'Limited Telepathy',
      description:
        "Limited Telepathy. The otyugh can magically transmit simple messages and images to any creature within 120 feet of it that can understand a language. This form of telepathy doesn't allow the receiving creature to telepathically respond.",
      order: 1
    },
    {
      id: S.featureId(213, 2),
      label: 'Multiattack',
      description:
        'Multiattack. The otyugh makes three attacks: one with its bite and two with its tentacles.',
      order: 2
    },
    {
      id: S.featureId(213, 3),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 12 (2d8 + 3) piercing damage. If the target is a creature, it must succeed on a DC 15 Constitution saving throw against disease or become poisoned until the disease is cured. Every 24 hours that elapse, the target must repeat the saving throw, reducing its hit point maximum by 5 (1d10) on a failure. The disease is cured on a success. The target dies if the disease reduces its hit point maximum to 0. This reduction to the target's hit point maximum lasts until the disease is cured.",
      effects: [
        S.weaponAttack({
          creatureIndex: 213,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '2d8',
          ability: 'STRENGTH',
          followUpSave: S.conditionSave({
            id: S.actionId(213, 7),
            savingThrowId: S.actionId(213, 8),
            ability: 'CONSTITUTION',
            dc: 15,
            conditionOutcomeId: S.actionId(213, 9),
            conditionId: conditionTypeId('POISONED'),
            repeatsAtTurnEnd: false
          })
        })
      ],
      order: 3
    },
    {
      id: S.featureId(213, 4),
      label: 'Tentacle',
      description:
        'Tentacle. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage plus 4 (1d8) piercing damage. If the target is Medium or smaller, it is grappled (escape DC 13) and restrained until the grapple ends. The otyugh has two tentacles, each of which can grapple one target.',
      effects: [
        S.weaponAttack({
          creatureIndex: 213,
          localIndex: 11,
          kind: 'MELEE',
          feet: 10,
          damageType: 'BLUDGEONING',
          diceConfig: '1d8',
          ability: 'STRENGTH',
          extraDamage: [{ damageType: 'PIERCING', diceConfig: '1d8' }],
          grapple: {
            localIndex: 1,
            escapeDc: 13,
            heldAtOnce: 2,
            largestTarget: S.SIZE_CODE.MEDIUM,
            untilEnds: ['RESTRAINED']
          }
        })
      ],
      order: 4
    },
    {
      id: S.featureId(213, 5),
      label: 'Tentacle Slam',
      description:
        "Tentacle Slam. The otyugh slams creatures grappled by it into each other or a solid surface. Each creature must succeed on a DC 14 Constitution saving throw or take 10 (2d6 + 3) bludgeoning damage and be stunned until the end of the otyugh's next turn. On a successful save, the target takes half the bludgeoning damage and isn't stunned.",
      order: 5
    }
  ]
}
