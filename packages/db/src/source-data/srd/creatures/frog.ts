import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const frog: CreatureAuthored = {
  id: S.CREATURE_IDS.FROG,
  label: 'Frog',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 1,
    DEXTERITY: 13,
    CONSTITUTION: 8,
    INTELLIGENCE: 1,
    WISDOM: 8,
    CHARISMA: 3,
    SPELLCASTING: 0
  },
  armorClass: 11,
  hitPoints: 1,
  hitDice: '1d4 - 1',
  speeds: [...S.walk(20), ...S.swim(20)],
  proficiencies: [
    S.grantedSkillProficiency(106, 1, 'PERCEPTION', 'STEALTH')
  ],
  senses: ['darkvision 30 ft.'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_0,
  xp: 0,
  features: [
    {
      id: S.featureId(106, 1),
      label: 'Amphibious',
      description: 'Amphibious. The frog can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(106, 2),
      label: 'Standing Leap',
      description: "Standing Leap. The frog's long jump is up to 10 feet and its high jump is up to 5 feet, with or without a running start. A frog has no effective attacks. It feeds on small insects and typically dwells near water, in trees, or underground. The frog's statistics can also be used to represent a toad.",
      order: 2
    }
  ]
}
