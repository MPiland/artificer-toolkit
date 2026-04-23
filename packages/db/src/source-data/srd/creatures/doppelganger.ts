import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const doppelganger: CreatureAuthored = {
  id: S.CREATURE_IDS.DOPPELGANGER,
  label: 'Doppelganger',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['shapechanger'],
  abilityScores: {
    STRENGTH: 11,
    DEXTERITY: 18,
    CONSTITUTION: 14,
    INTELLIGENCE: 11,
    WISDOM: 12,
    CHARISMA: 14,
    SPELLCASTING: 0
  },
  armorClass: 14,
  hitPoints: 52,
  hitDice: '8d8+16',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(83, 1, 'DECEPTION', 'INSIGHT'),
    S.grantedLanguageProficiency(83, 2, 'COMMON')
  ],
  conditionImmunities: ['charmed'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(83, 1),
      label: 'Shapechanger',
      description: "Shapechanger. The doppelganger can use its action to polymorph into a Small or Medium humanoid it has seen, or back into its true form. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      order: 1
    },
    {
      id: S.featureId(83, 2),
      label: 'Ambusher',
      description: 'Ambusher. In the first round of a combat, the doppelganger has advantage on attack rolls against any creature it has surprised.',
      order: 2
    },
    {
      id: S.featureId(83, 3),
      label: 'Surprise Attack',
      description: 'Surprise Attack. If the doppelganger surprises a creature and hits it with an attack during the first round of combat, the target takes an extra 10 (3d6) damage from the attack.',
      order: 3
    },
    {
      id: S.featureId(83, 4),
      label: 'Multiattack',
      description: 'Multiattack. The doppelganger makes two melee attacks.',
      order: 4
    },
    {
      id: S.featureId(83, 5),
      label: 'Slam',
      description: 'Slam. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 7 (1d6 + 4) bludgeoning damage.',
      order: 5
    },
    {
      id: S.featureId(83, 6),
      label: 'Read Thoughts',
      description: "Read Thoughts. The doppelganger magically reads the surface thoughts of one creature within 60 feet of it. The effect can penetrate barriers, but 3 feet of wood or dirt, 2 feet of stone, 2 inches of metal, or a thin sheet of lead blocks it. While the target is in range, the doppelganger can continue reading its thoughts, as long as the doppelganger's concentration isn't broken (as if concentrating on a spell). While reading the target's mind, the doppelganger has advantage on Wisdom (Insight) and Charisma (Deception, Intimidation, and Persuasion) checks against the target.",
      order: 6
    }
  ]
}

